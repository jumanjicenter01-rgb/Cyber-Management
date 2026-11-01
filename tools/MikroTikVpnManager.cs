using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Net.NetworkInformation;
using System.Text;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Drawing;
using System.Windows.Forms;
using System.Threading;

namespace MikroTikVpnManager
{
    // ==========================================
    // 1. MIKROTIK ROUTEROS API SOCKET CLIENT
    // ==========================================
    public class MikroTikClient : IDisposable
    {
        private TcpClient _client;
        private NetworkStream _stream;
        public string Host { get; set; }
        public int Port { get; set; }
        public string Username { get; set; }
        public string Password { get; set; }

        public MikroTikClient(string host, int port, string user, string pass)
        {
            Host = host;
            Port = port > 0 ? port : 8728;
            Username = user;
            Password = pass ?? "";
        }

        public void Connect(int timeoutMs = 4000)
        {
            _client = new TcpClient();
            var result = _client.BeginConnect(Host, Port, null, null);
            bool success = result.AsyncWaitHandle.WaitOne(timeoutMs);
            if (!success)
            {
                _client.Close();
                throw new TimeoutException(string.Format("فشل الاتصال بالمايكروتك عند {0}:{1} (انتهت المهلة {2} ثواني)", Host, Port, timeoutMs / 1000));
            }
            _client.EndConnect(result);
            _client.ReceiveTimeout = timeoutMs;
            _client.SendTimeout = timeoutMs;
            _stream = _client.GetStream();

            Login();
        }

        private void Login()
        {
            // RouterOS 6.43+ plaintext login attempt
            byte[] cmd = EncodeSentence("/login", "=name=" + Username, "=password=" + Password);
            _stream.Write(cmd, 0, cmd.Length);

            var resp = ReadSentence();
            if (resp.Count == 0) throw new Exception("لم يتم استلام استجابة من المايكروتك بعد إرسال تسجيل الدخول");

            if (resp[0] == "!done")
            {
                // Check if challenge returned (older RouterOS < 6.43)
                string retWord = null;
                for (int i = 0; i < resp.Count; i++)
                {
                    if (resp[i].StartsWith("=ret=")) { retWord = resp[i]; break; }
                }

                if (retWord != null)
                {
                    string chal = retWord.Substring(5);
                    byte[] passBytes = Encoding.UTF8.GetBytes(Password);
                    byte[] chalBytes = HexToBytes(chal);
                    byte[] toHash = new byte[1 + passBytes.Length + chalBytes.Length];
                    toHash[0] = 0;
                    Buffer.BlockCopy(passBytes, 0, toHash, 1, passBytes.Length);
                    Buffer.BlockCopy(chalBytes, 0, toHash, 1 + passBytes.Length, chalBytes.Length);
                    string hexHash;
                    using (var md5 = MD5.Create())
                    {
                        hexHash = BitConverter.ToString(md5.ComputeHash(toHash)).Replace("-", "").ToLowerInvariant();
                    }
                    byte[] respCmd = EncodeSentence("/login", "=name=" + Username, "=response=00" + hexHash);
                    _stream.Write(respCmd, 0, respCmd.Length);
                    var finalResp = ReadSentence();
                    if (finalResp.Count == 0 || finalResp[0] != "!done")
                    {
                        throw new Exception("فشل التحقق من كلمة مرور المايكروتك (Authentication failed)");
                    }
                }
            }
            else if (resp[0] == "!trap")
            {
                string msg = "بيانات الدخول للمايكروتك غير صحيحة";
                for (int i = 0; i < resp.Count; i++)
                {
                    if (resp[i].StartsWith("=message=")) { msg = resp[i].Substring(9); break; }
                }
                throw new Exception("خطأ تسجيل الدخول: " + msg);
            }
            else
            {
                throw new Exception("استجابة غير متوقعة من المايكروتك: " + resp[0]);
            }
        }

        public List<Dictionary<string, string>> GetAddressList(string listName)
        {
            var results = new List<Dictionary<string, string>>();
            byte[] cmd = EncodeSentence("/ip/firewall/address-list/print", "?list=" + listName);
            _stream.Write(cmd, 0, cmd.Length);

            while (true)
            {
                var sentence = ReadSentence();
                if (sentence.Count == 0) break;
                string type = sentence[0];

                if (type == "!re")
                {
                    var dict = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                    for (int i = 1; i < sentence.Count; i++)
                    {
                        string word = sentence[i];
                        if (word.StartsWith("="))
                        {
                            int eqIdx = word.IndexOf('=', 1);
                            if (eqIdx > 1)
                            {
                                string key = word.Substring(1, eqIdx - 1);
                                string val = word.Substring(eqIdx + 1);
                                dict[key] = val;
                            }
                        }
                    }
                    results.Add(dict);
                }
                else if (type == "!done" || type == "!trap")
                {
                    break;
                }
            }
            return results;
        }

        public bool AddToAddressList(string listName, string address, string comment)
        {
            // First check if already exists
            var existing = GetAddressList(listName);
            for (int i = 0; i < existing.Count; i++)
            {
                if (existing[i].ContainsKey("address") && existing[i]["address"].Trim() == address.Trim())
                {
                    return false; // Already present
                }
            }

            var words = new List<string>();
            words.Add("/ip/firewall/address-list/add");
            words.Add("=list=" + listName);
            words.Add("=address=" + address.Trim());
            if (!string.IsNullOrEmpty(comment))
            {
                words.Add("=comment=" + comment.Trim());
            }

            byte[] cmd = EncodeSentence(words.ToArray());
            _stream.Write(cmd, 0, cmd.Length);

            var resp = ReadSentence();
            if (resp.Count > 0 && resp[0] == "!trap")
            {
                string msg = "فشل إضافة الآي بي";
                for (int i = 0; i < resp.Count; i++)
                {
                    if (resp[i].StartsWith("=message=")) { msg = resp[i].Substring(9); break; }
                }
                throw new Exception(msg);
            }
            return true;
        }

        public int RemoveFromAddressList(string listName, string address)
        {
            var existing = GetAddressList(listName);
            int count = 0;
            for (int i = 0; i < existing.Count; i++)
            {
                if (existing[i].ContainsKey("address") && existing[i]["address"].Trim() == address.Trim())
                {
                    string id = existing[i].ContainsKey(".id") ? existing[i][".id"] : null;
                    if (!string.IsNullOrEmpty(id))
                    {
                        byte[] cmd = EncodeSentence("/ip/firewall/address-list/remove", "=.id=" + id);
                        _stream.Write(cmd, 0, cmd.Length);
                        ReadSentence(); // wait for !done
                        count++;
                    }
                }
            }
            return count;
        }

        public int RemoveAllFromAddressList(string listName)
        {
            var existing = GetAddressList(listName);
            int count = 0;
            for (int i = 0; i < existing.Count; i++)
            {
                string id = existing[i].ContainsKey(".id") ? existing[i][".id"] : null;
                if (!string.IsNullOrEmpty(id))
                {
                    byte[] cmd = EncodeSentence("/ip/firewall/address-list/remove", "=.id=" + id);
                    _stream.Write(cmd, 0, cmd.Length);
                    ReadSentence();
                    count++;
                }
            }
            return count;
        }

        public string GetSystemIdentity()
        {
            byte[] cmd = EncodeSentence("/system/identity/print");
            _stream.Write(cmd, 0, cmd.Length);
            string name = "MikroTik";
            while (true)
            {
                var sentence = ReadSentence();
                if (sentence.Count == 0) break;
                if (sentence[0] == "!re")
                {
                    for (int i = 1; i < sentence.Count; i++)
                    {
                        if (sentence[i].StartsWith("=name="))
                        {
                            name = sentence[i].Substring(6);
                        }
                    }
                }
                else if (sentence[0] == "!done" || sentence[0] == "!trap")
                {
                    break;
                }
            }
            return name;
        }

        // Protocol Helpers
        private static byte[] EncodeWord(string word)
        {
            byte[] textBytes = Encoding.UTF8.GetBytes(word);
            int len = textBytes.Length;
            byte[] lenBytes;
            if (len < 0x80) lenBytes = new byte[] { (byte)len };
            else if (len < 0x4000) lenBytes = new byte[] { (byte)((len >> 8) | 0x80), (byte)(len & 0xFF) };
            else if (len < 0x200000) lenBytes = new byte[] { (byte)((len >> 16) | 0xC0), (byte)((len >> 8) & 0xFF), (byte)(len & 0xFF) };
            else lenBytes = new byte[] { 0xE0, (byte)((len >> 16) & 0xFF), (byte)((len >> 8) & 0xFF), (byte)(len & 0xFF) };

            byte[] res = new byte[lenBytes.Length + textBytes.Length];
            Buffer.BlockCopy(lenBytes, 0, res, 0, lenBytes.Length);
            Buffer.BlockCopy(textBytes, 0, res, lenBytes.Length, textBytes.Length);
            return res;
        }

        private static byte[] EncodeSentence(params string[] words)
        {
            using (var ms = new MemoryStream())
            {
                for (int i = 0; i < words.Length; i++)
                {
                    byte[] wb = EncodeWord(words[i]);
                    ms.Write(wb, 0, wb.Length);
                }
                ms.WriteByte(0x00);
                return ms.ToArray();
            }
        }

        private int ReadLength()
        {
            int b = _stream.ReadByte();
            if (b == -1) throw new EndOfStreamException("انقطع الاتصال بالراوتر");
            if ((b & 0x80) == 0) return b;
            if ((b & 0xC0) == 0x80)
            {
                int b2 = _stream.ReadByte();
                return ((b & 0x3F) << 8) | b2;
            }
            if ((b & 0xE0) == 0xC0)
            {
                int b2 = _stream.ReadByte();
                int b3 = _stream.ReadByte();
                return ((b & 0x1F) << 16) | (b2 << 8) | b3;
            }
            return 0;
        }

        private string ReadWord()
        {
            int len = ReadLength();
            if (len == 0) return null;
            byte[] buf = new byte[len];
            int read = 0;
            while (read < len)
            {
                int r = _stream.Read(buf, read, len - read);
                if (r <= 0) throw new EndOfStreamException("انقطع الاتصال بالراوتر أثناء قراءة البيانات");
                read += r;
            }
            return Encoding.UTF8.GetString(buf);
        }

        private List<string> ReadSentence()
        {
            var words = new List<string>();
            while (true)
            {
                string w = ReadWord();
                if (w == null) break;
                words.Add(w);
            }
            return words;
        }

        private static byte[] HexToBytes(string hex)
        {
            if (hex.Length % 2 != 0) hex = "0" + hex;
            byte[] bytes = new byte[hex.Length / 2];
            for (int i = 0; i < hex.Length; i += 2)
            {
                bytes[i / 2] = Convert.ToByte(hex.Substring(i, 2), 16);
            }
            return bytes;
        }

        public void Dispose()
        {
            try { if (_stream != null) _stream.Close(); } catch { }
            try { if (_client != null) _client.Close(); } catch { }
        }
    }

    // ==========================================
    // 2. CONFIGURATION MANAGER
    // ==========================================
    public class ToolConfig
    {
        public string Host = "10.10.10.1";
        public int Port = 8728;
        public string Username = "admin";
        public string Password = "0184255";
        public string AddressList = "GAMING-VPN";

        private static string ConfigPath
        {
            get
            {
                string dir = AppDomain.CurrentDomain.BaseDirectory;
                return Path.Combine(dir, "mikrotik_vpn_settings.ini");
            }
        }

        public static ToolConfig Load()
        {
            var config = new ToolConfig();
            try
            {
                if (File.Exists(ConfigPath))
                {
                    string[] lines = File.ReadAllLines(ConfigPath);
                    for (int i = 0; i < lines.Length; i++)
                    {
                        string line = lines[i].Trim();
                        if (string.IsNullOrEmpty(line) || line.StartsWith("#")) continue;
                        int idx = line.IndexOf('=');
                        if (idx > 0)
                        {
                            string k = line.Substring(0, idx).Trim().ToLowerInvariant();
                            string v = line.Substring(idx + 1).Trim();
                            if (k == "host") config.Host = v;
                            else if (k == "port") int.TryParse(v, out config.Port);
                            else if (k == "username" || k == "user") config.Username = v;
                            else if (k == "password" || k == "pass") config.Password = v;
                            else if (k == "addresslist" || k == "list") config.AddressList = v;
                        }
                    }
                }
            }
            catch { }
            return config;
        }

        public void Save()
        {
            try
            {
                var sb = new StringBuilder();
                sb.AppendLine("# MikroTik VPN Manager Settings");
                sb.AppendLine("host=" + Host);
                sb.AppendLine("port=" + Port);
                sb.AppendLine("username=" + Username);
                sb.AppendLine("password=" + Password);
                sb.AppendLine("addresslist=" + AddressList);
                File.WriteAllText(ConfigPath, sb.ToString(), Encoding.UTF8);
            }
            catch { }
        }
    }

    // ==========================================
    // 3. MAIN WINDOWS FORM (DARK CYBER THEME)
    // ==========================================
    public class MainForm : Form
    {
        private ToolConfig _config;

        // UI Controls
        private Label lblHeaderTitle;
        private Label lblHeaderSub;
        private Label lblStatusBadge;

        private TextBox txtTargetIp;
        private Button btnUseMyIp;
        private FlowLayoutPanel flowPresets;

        private Button btnConnectVpn;
        private Button btnDisconnectVpn;

        private Label lblListTitle;
        private Button btnRefreshList;
        private Button btnDisconnectAll;
        private ListView lvActiveVpn;

        private GroupBox grpSettings;
        private TextBox txtHost;
        private TextBox txtPort;
        private TextBox txtUser;
        private TextBox txtPass;
        private TextBox txtList;
        private Button btnTestConnection;
        private Button btnSaveSettings;
        private Button btnToggleSettings;

        private Label lblLog;
        private System.Windows.Forms.Timer autoRefreshTimer;

        // Colors
        private readonly Color C_BG_DARK = Color.FromArgb(15, 23, 42);      // #0F172A
        private readonly Color C_PANEL = Color.FromArgb(30, 41, 59);        // #1E293B
        private readonly Color C_PANEL_LIGHT = Color.FromArgb(51, 65, 85);  // #334155
        private readonly Color C_ACCENT_BLUE = Color.FromArgb(56, 189, 248);// #38BDF8
        private readonly Color C_GREEN = Color.FromArgb(16, 185, 129);      // #10B981
        private readonly Color C_GREEN_HOVER = Color.FromArgb(5, 150, 105);
        private readonly Color C_RED = Color.FromArgb(239, 68, 68);         // #EF4444
        private readonly Color C_RED_HOVER = Color.FromArgb(220, 38, 38);
        private readonly Color C_TEXT = Color.FromArgb(248, 250, 252);
        private readonly Color C_MUTED = Color.FromArgb(148, 163, 184);

        public MainForm()
        {
            _config = ToolConfig.Load();
            InitializeComponent();
            ApplyStyling();
            
            // Auto detect my IP on start
            DetectAndSetLocalIp();

            // Refresh list on load
            this.Shown += (s, e) =>
            {
                RefreshActiveListAsync();
            };

            // Background auto-refresh timer (every 10 seconds)
            autoRefreshTimer = new System.Windows.Forms.Timer();
            autoRefreshTimer.Interval = 10000;
            autoRefreshTimer.Tick += (s, e) => { RefreshActiveListAsync(true); };
            autoRefreshTimer.Start();
        }

        private void InitializeComponent()
        {
            this.Text = "MikroTik Gaming VPN Manager | أداة تحويل الأجهزة للفي بي ان";
            this.Size = new Size(580, 780);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.BackColor = C_BG_DARK;
            this.ForeColor = C_TEXT;
            this.Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);
            this.RightToLeft = RightToLeft.Yes;
            this.RightToLeftLayout = true;

            // --- HEADER PANEL ---
            var pnlHeader = new Panel
            {
                Dock = DockStyle.Top,
                Height = 85,
                BackColor = C_PANEL,
                Padding = new Padding(16, 10, 16, 10)
            };

            lblHeaderTitle = new Label
            {
                Text = "⚡ MikroTik Gaming VPN Manager",
                Font = new Font("Segoe UI", 14f, FontStyle.Bold),
                ForeColor = C_ACCENT_BLUE,
                Location = new Point(16, 12),
                AutoSize = true
            };

            lblHeaderSub = new Label
            {
                Text = "أداة سريعة لتحويل أي جهاز إلى مسار الـ VPN مباشرة عبر راوتر مايكروتك",
                Font = new Font("Segoe UI", 8.5f),
                ForeColor = C_MUTED,
                Location = new Point(16, 42),
                AutoSize = true
            };

            lblStatusBadge = new Label
            {
                Text = "● جارٍ التحقق...",
                Font = new Font("Segoe UI", 9f, FontStyle.Bold),
                ForeColor = Color.Gold,
                BackColor = Color.FromArgb(40, 40, 50),
                Padding = new Padding(8, 4, 8, 4),
                Location = new Point(410, 18),
                Size = new Size(130, 28),
                TextAlign = ContentAlignment.MiddleCenter
            };

            pnlHeader.Controls.Add(lblHeaderTitle);
            pnlHeader.Controls.Add(lblHeaderSub);
            pnlHeader.Controls.Add(lblStatusBadge);
            this.Controls.Add(pnlHeader);

            // --- MAIN CONTAINER ---
            int y = 95;

            // --- SECTION 1: TARGET IP INPUT ---
            var pnlIpBox = new Panel
            {
                Location = new Point(16, y),
                Size = new Size(532, 115),
                BackColor = C_PANEL,
                Padding = new Padding(12)
            };

            var lblIpPrompt = new Label
            {
                Text = "🎯 عنوان الآي بي للجهاز (Target IP Address):",
                Font = new Font("Segoe UI", 10.5f, FontStyle.Bold),
                ForeColor = C_TEXT,
                Location = new Point(12, 10),
                AutoSize = true
            };

            txtTargetIp = new TextBox
            {
                Location = new Point(170, 40),
                Size = new Size(230, 32),
                Font = new Font("Consolas", 14f, FontStyle.Bold),
                BackColor = Color.FromArgb(15, 23, 42),
                ForeColor = C_ACCENT_BLUE,
                TextAlign = HorizontalAlignment.Center
            };

            btnUseMyIp = new Button
            {
                Text = "📍 آي بي هذا الجهاز",
                Location = new Point(12, 38),
                Size = new Size(145, 34),
                FlatStyle = FlatStyle.Flat,
                BackColor = C_PANEL_LIGHT,
                ForeColor = C_TEXT,
                Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            btnUseMyIp.Click += (s, e) => DetectAndSetLocalIp();

            var lblPresets = new Label
            {
                Text = "أجهزة سريعة:",
                Font = new Font("Segoe UI", 8.5f),
                ForeColor = C_MUTED,
                Location = new Point(440, 80),
                AutoSize = true
            };

            flowPresets = new FlowLayoutPanel
            {
                Location = new Point(12, 76),
                Size = new Size(420, 32),
                FlowDirection = FlowDirection.RightToLeft,
                WrapContents = false
            };

            // Preset Buttons for Cyber PCs
            string[] presetPcs = new string[] { "PC-15 (115)", "PC-01 (101)", "PC-02 (102)", "PC-03 (103)", "PC-04 (104)", "PC-10 (110)" };
            for (int i = 0; i < presetPcs.Length; i++)
            {
                string label = presetPcs[i];
                string ip = "10.10.10." + label.Substring(label.IndexOf('(') + 1).Replace(")", "");
                var btnP = new Button
                {
                    Text = label,
                    Size = new Size(76, 26),
                    FlatStyle = FlatStyle.Flat,
                    BackColor = Color.FromArgb(45, 55, 72),
                    ForeColor = C_TEXT,
                    Font = new Font("Segoe UI", 7.5f),
                    Margin = new Padding(2, 0, 2, 0),
                    Cursor = Cursors.Hand
                };
                btnP.FlatAppearance.BorderSize = 0;
                btnP.Click += (s, e) => { txtTargetIp.Text = ip; };
                flowPresets.Controls.Add(btnP);
            }

            pnlIpBox.Controls.Add(lblIpPrompt);
            pnlIpBox.Controls.Add(txtTargetIp);
            pnlIpBox.Controls.Add(btnUseMyIp);
            pnlIpBox.Controls.Add(lblPresets);
            pnlIpBox.Controls.Add(flowPresets);
            this.Controls.Add(pnlIpBox);

            y += 125;

            // --- SECTION 2: BIG CONNECT / DISCONNECT BUTTONS ---
            btnConnectVpn = new Button
            {
                Text = "🟢 توصيل بالـ VPN\n(إضافة إلى GAMING-VPN)",
                Location = new Point(286, y),
                Size = new Size(262, 54),
                FlatStyle = FlatStyle.Flat,
                BackColor = C_GREEN,
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 11.5f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            btnConnectVpn.FlatAppearance.BorderSize = 0;
            btnConnectVpn.Click += (s, e) => ConnectIpToVpnAsync();

            btnDisconnectVpn = new Button
            {
                Text = "🔴 فصل من الـ VPN\n(إزالة من GAMING-VPN)",
                Location = new Point(16, y),
                Size = new Size(262, 54),
                FlatStyle = FlatStyle.Flat,
                BackColor = C_RED,
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 11.5f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            btnDisconnectVpn.FlatAppearance.BorderSize = 0;
            btnDisconnectVpn.Click += (s, e) => DisconnectIpFromVpnAsync();

            this.Controls.Add(btnConnectVpn);
            this.Controls.Add(btnDisconnectVpn);

            y += 64;

            // --- SECTION 3: ACTIVE VPN LIST VIEW ---
            var pnlListHeader = new Panel
            {
                Location = new Point(16, y),
                Size = new Size(532, 34),
                BackColor = Color.Transparent
            };

            lblListTitle = new Label
            {
                Text = "📋 الأجهزة المتصلة بالـ VPN حالياً في المايكروتك (0):",
                Font = new Font("Segoe UI", 10f, FontStyle.Bold),
                ForeColor = C_TEXT,
                Location = new Point(160, 6),
                AutoSize = true
            };

            btnRefreshList = new Button
            {
                Text = "🔄 تحديث",
                Location = new Point(80, 2),
                Size = new Size(72, 28),
                FlatStyle = FlatStyle.Flat,
                BackColor = C_PANEL_LIGHT,
                ForeColor = C_TEXT,
                Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            btnRefreshList.Click += (s, e) => RefreshActiveListAsync();

            btnDisconnectAll = new Button
            {
                Text = "🧹 فصل الكل",
                Location = new Point(0, 2),
                Size = new Size(76, 28),
                FlatStyle = FlatStyle.Flat,
                BackColor = Color.FromArgb(127, 29, 29),
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            btnDisconnectAll.Click += (s, e) => DisconnectAllAsync();

            pnlListHeader.Controls.Add(lblListTitle);
            pnlListHeader.Controls.Add(btnRefreshList);
            pnlListHeader.Controls.Add(btnDisconnectAll);
            this.Controls.Add(pnlListHeader);

            y += 38;

            lvActiveVpn = new ListView
            {
                Location = new Point(16, y),
                Size = new Size(532, 175),
                View = View.Details,
                FullRowSelect = true,
                GridLines = true,
                BackColor = C_PANEL,
                ForeColor = C_TEXT,
                Font = new Font("Consolas", 10f),
                BorderStyle = BorderStyle.FixedSingle
            };
            lvActiveVpn.Columns.Add("عنوان الآي بي (IP)", 140, HorizontalAlignment.Center);
            lvActiveVpn.Columns.Add("الملاحظة / اسم الجهاز (Comment)", 240, HorizontalAlignment.Right);
            lvActiveVpn.Columns.Add("الوقت / التاريخ", 120, HorizontalAlignment.Center);

            // Double click row loads it into textbox
            lvActiveVpn.DoubleClick += (s, e) =>
            {
                if (lvActiveVpn.SelectedItems.Count > 0)
                {
                    txtTargetIp.Text = lvActiveVpn.SelectedItems[0].Text;
                }
            };

            // Context Menu for right click on IP
            var ctx = new ContextMenuStrip();
            var mnuDisconnect = ctx.Items.Add("🔴 فصل هذا الجهاز من الـ VPN");
            mnuDisconnect.Click += (s, e) =>
            {
                if (lvActiveVpn.SelectedItems.Count > 0)
                {
                    string ip = lvActiveVpn.SelectedItems[0].Text;
                    txtTargetIp.Text = ip;
                    DisconnectIpFromVpnAsync(ip);
                }
            };
            var mnuCopy = ctx.Items.Add("📋 نسخ عنوان الآي بي");
            mnuCopy.Click += (s, e) =>
            {
                if (lvActiveVpn.SelectedItems.Count > 0)
                {
                    Clipboard.SetText(lvActiveVpn.SelectedItems[0].Text);
                    SetLog("تم نسخ الآي بي: " + lvActiveVpn.SelectedItems[0].Text, C_GREEN);
                }
            };
            lvActiveVpn.ContextMenuStrip = ctx;

            this.Controls.Add(lvActiveVpn);

            y += 185;

            // --- SECTION 4: MIKROTIK SETTINGS (EXPANDABLE) ---
            btnToggleSettings = new Button
            {
                Text = "⚙️ إعدادات اتصال المايكروتك (اضغط للتعديل)",
                Location = new Point(16, y),
                Size = new Size(532, 30),
                FlatStyle = FlatStyle.Flat,
                BackColor = Color.FromArgb(20, 30, 48),
                ForeColor = C_ACCENT_BLUE,
                Font = new Font("Segoe UI", 9f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            btnToggleSettings.FlatAppearance.BorderSize = 0;
            btnToggleSettings.Click += (s, e) =>
            {
                grpSettings.Visible = !grpSettings.Visible;
                btnToggleSettings.Text = grpSettings.Visible
                    ? "⚙️ إخفاء إعدادات اتصال المايكروتك ▲"
                    : "⚙️ إعدادات اتصال المايكروتك (اضغط للتعديل) ▼";
            };
            this.Controls.Add(btnToggleSettings);

            y += 34;

            grpSettings = new GroupBox
            {
                Text = "بيانات راوتر مايكروتك (RouterOS API Socket):",
                Location = new Point(16, y),
                Size = new Size(532, 135),
                ForeColor = C_MUTED,
                BackColor = C_PANEL,
                Font = new Font("Segoe UI", 8.5f),
                Visible = false // hidden by default for clean look
            };

            // Row 1: Host & Port
            var lblH = new Label { Text = "آي بي الراوتر:", Location = new Point(430, 24), AutoSize = true, ForeColor = C_TEXT };
            txtHost = new TextBox { Text = _config.Host, Location = new Point(310, 22), Size = new Size(115, 24), BackColor = C_BG_DARK, ForeColor = C_TEXT };

            var lblP = new Label { Text = "المنفذ:", Location = new Point(255, 24), AutoSize = true, ForeColor = C_TEXT };
            txtPort = new TextBox { Text = _config.Port.ToString(), Location = new Point(190, 22), Size = new Size(60, 24), BackColor = C_BG_DARK, ForeColor = C_TEXT };

            var lblL = new Label { Text = "قائمة الـ VPN:", Location = new Point(110, 24), AutoSize = true, ForeColor = C_TEXT };
            txtList = new TextBox { Text = _config.AddressList, Location = new Point(10, 22), Size = new Size(95, 24), BackColor = C_BG_DARK, ForeColor = C_TEXT };

            // Row 2: User & Password
            var lblU = new Label { Text = "اسم المستخدم:", Location = new Point(430, 60), AutoSize = true, ForeColor = C_TEXT };
            txtUser = new TextBox { Text = _config.Username, Location = new Point(310, 58), Size = new Size(115, 24), BackColor = C_BG_DARK, ForeColor = C_TEXT };

            var lblPw = new Label { Text = "كلمة المرور:", Location = new Point(245, 60), AutoSize = true, ForeColor = C_TEXT };
            txtPass = new TextBox { Text = _config.Password, Location = new Point(140, 58), Size = new Size(100, 24), BackColor = C_BG_DARK, ForeColor = C_TEXT, UseSystemPasswordChar = true };

            btnTestConnection = new Button
            {
                Text = "⚡ اختبار الاتصال",
                Location = new Point(150, 95),
                Size = new Size(130, 28),
                FlatStyle = FlatStyle.Flat,
                BackColor = C_PANEL_LIGHT,
                ForeColor = C_TEXT,
                Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            btnTestConnection.Click += (s, e) => TestConnectionAsync();

            btnSaveSettings = new Button
            {
                Text = "💾 حفظ الإعدادات",
                Location = new Point(10, 95),
                Size = new Size(130, 28),
                FlatStyle = FlatStyle.Flat,
                BackColor = C_GREEN,
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
                Cursor = Cursors.Hand
            };
            btnSaveSettings.Click += (s, e) => SaveSettings();

            grpSettings.Controls.Add(lblH); grpSettings.Controls.Add(txtHost);
            grpSettings.Controls.Add(lblP); grpSettings.Controls.Add(txtPort);
            grpSettings.Controls.Add(lblL); grpSettings.Controls.Add(txtList);
            grpSettings.Controls.Add(lblU); grpSettings.Controls.Add(txtUser);
            grpSettings.Controls.Add(lblPw); grpSettings.Controls.Add(txtPass);
            grpSettings.Controls.Add(btnTestConnection);
            grpSettings.Controls.Add(btnSaveSettings);
            this.Controls.Add(grpSettings);

            // --- BOTTOM LOG STATUS BAR ---
            lblLog = new Label
            {
                Text = "جاهز. أدخل آي بي أي جهاز واضغط توصيل لإضافته فوراً لمسار الـ VPN.",
                Dock = DockStyle.Bottom,
                Height = 32,
                BackColor = Color.FromArgb(8, 12, 22),
                ForeColor = C_MUTED,
                Font = new Font("Segoe UI", 9f),
                TextAlign = ContentAlignment.MiddleLeft,
                Padding = new Padding(12, 0, 12, 0)
            };
            this.Controls.Add(lblLog);
        }

        private void ApplyStyling()
        {
            btnUseMyIp.FlatAppearance.BorderColor = C_PANEL_LIGHT;
            btnRefreshList.FlatAppearance.BorderColor = C_PANEL_LIGHT;
            btnDisconnectAll.FlatAppearance.BorderColor = C_RED;
            btnTestConnection.FlatAppearance.BorderColor = C_PANEL_LIGHT;
            btnSaveSettings.FlatAppearance.BorderSize = 0;
        }

        // Helper: Detect Active Local IPv4
        private void DetectAndSetLocalIp()
        {
            try
            {
                string bestIp = null;
                foreach (var ni in NetworkInterface.GetAllNetworkInterfaces())
                {
                    if (ni.OperationalStatus != OperationalStatus.Up) continue;
                    if (ni.NetworkInterfaceType == NetworkInterfaceType.Loopback) continue;

                    var ipProps = ni.GetIPProperties();
                    foreach (var addr in ipProps.UnicastAddresses)
                    {
                        if (addr.Address.AddressFamily == AddressFamily.InterNetwork)
                        {
                            string ipStr = addr.Address.ToString();
                            if (ipStr.StartsWith("10.10.10."))
                            {
                                bestIp = ipStr;
                                break;
                            }
                            else if (bestIp == null && !ipStr.StartsWith("127."))
                            {
                                bestIp = ipStr;
                            }
                        }
                    }
                    if (bestIp != null && bestIp.StartsWith("10.10.10.")) break;
                }

                if (!string.IsNullOrEmpty(bestIp))
                {
                    txtTargetIp.Text = bestIp;
                    SetLog("تم تحديد آي بي هذا الجهاز تلقائياً: " + bestIp, C_ACCENT_BLUE);
                }
                else
                {
                    txtTargetIp.Text = "10.10.10.115";
                }
            }
            catch (Exception ex)
            {
                txtTargetIp.Text = "10.10.10.115";
                SetLog("تعذر كشف الآي بي تلقائياً: " + ex.Message, C_MUTED);
            }
        }

        private void SetLog(string msg, Color col)
        {
            if (this.InvokeRequired)
            {
                this.BeginInvoke(new Action(() => SetLog(msg, col)));
                return;
            }
            lblLog.Text = "[" + DateTime.Now.ToString("HH:mm:ss") + "] " + msg;
            lblLog.ForeColor = col;
        }

        private void SetStatusBadge(bool connected, string text = null)
        {
            if (this.InvokeRequired)
            {
                this.BeginInvoke(new Action(() => SetStatusBadge(connected, text)));
                return;
            }
            if (connected)
            {
                lblStatusBadge.Text = text ?? "🟢 مايكروتك متصل";
                lblStatusBadge.ForeColor = Color.FromArgb(52, 211, 153);
                lblStatusBadge.BackColor = Color.FromArgb(6, 78, 59);
            }
            else
            {
                lblStatusBadge.Text = text ?? "🔴 غير متصل";
                lblStatusBadge.ForeColor = Color.FromArgb(248, 113, 113);
                lblStatusBadge.BackColor = Color.FromArgb(127, 29, 29);
            }
        }

        // ==========================================
        // ASYNC ACTIONS
        // ==========================================

        private void ConnectIpToVpnAsync()
        {
            string ip = txtTargetIp.Text.Trim();
            if (string.IsNullOrEmpty(ip))
            {
                MessageBox.Show("يرجى كتابة عنوان الآي بي أولاً!", "تنبيه", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                txtTargetIp.Focus();
                return;
            }

            IPAddress parsed;
            if (!IPAddress.TryParse(ip, out parsed))
            {
                MessageBox.Show("عنوان الآي بي غير صحيح: " + ip, "خطأ", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            btnConnectVpn.Enabled = false;
            btnConnectVpn.Text = "⏳ جارٍ الإضافة...";
            SetLog("جارٍ إضافة " + ip + " إلى قائمة الـ VPN بالمايكروتك...", C_ACCENT_BLUE);

            ThreadPool.QueueUserWorkItem(state =>
            {
                try
                {
                    using (var mt = new MikroTikClient(_config.Host, _config.Port, _config.Username, _config.Password))
                    {
                        mt.Connect(3500);
                        string comment = "VPN-Manual-" + ip + " [" + DateTime.Now.ToString("yyyy-MM-dd HH:mm") + "]";
                        bool added = mt.AddToAddressList(_config.AddressList, ip, comment);

                        this.BeginInvoke(new Action(() =>
                        {
                            SetStatusBadge(true);
                            if (added)
                            {
                                SetLog("✅ تم تحويل " + ip + " إلى مسار الـ VPN بنجاح! (" + _config.AddressList + ")", C_GREEN);
                                MessageBox.Show(string.Format("تم بنجاح!\nتم إضافة الجهاز {0} إلى مسار الـ VPN ({1}) في المايكروتك.", ip, _config.AddressList), "تم التوصيل بنجاح", MessageBoxButtons.OK, MessageBoxIcon.Information);
                            }
                            else
                            {
                                SetLog("ℹ️ الجهاز " + ip + " مضاف بالفعل مسبقاً في مسار الـ VPN", C_ACCENT_BLUE);
                                MessageBox.Show("الجهاز " + ip + " مضاف بالفعل في مسار الـ VPN!", "ملاحظة", MessageBoxButtons.OK, MessageBoxIcon.Information);
                            }
                            RefreshActiveListAsync();
                        }));
                    }
                }
                catch (Exception ex)
                {
                    this.BeginInvoke(new Action(() =>
                    {
                        SetStatusBadge(false);
                        SetLog("❌ فشل توصيل " + ip + ": " + ex.Message, C_RED);
                        MessageBox.Show("فشل الاتصال بالمايكروتك:\n" + ex.Message, "خطأ في المايكروتك", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    }));
                }
                finally
                {
                    this.BeginInvoke(new Action(() =>
                    {
                        btnConnectVpn.Enabled = true;
                        btnConnectVpn.Text = "🟢 توصيل بالـ VPN\n(إضافة إلى GAMING-VPN)";
                    }));
                }
            });
        }

        private void DisconnectIpFromVpnAsync(string specificIp = null)
        {
            string ip = (specificIp ?? txtTargetIp.Text).Trim();
            if (string.IsNullOrEmpty(ip))
            {
                MessageBox.Show("يرجى تحديد أو كتابة عنوان الآي بي المراد فصله!", "تنبيه", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            btnDisconnectVpn.Enabled = false;
            btnDisconnectVpn.Text = "⏳ جارٍ الفصل...";
            SetLog("جارٍ إزالة " + ip + " من قائمة الـ VPN بالمايكروتك...", C_ACCENT_BLUE);

            ThreadPool.QueueUserWorkItem(state =>
            {
                try
                {
                    using (var mt = new MikroTikClient(_config.Host, _config.Port, _config.Username, _config.Password))
                    {
                        mt.Connect(3500);
                        int count = mt.RemoveFromAddressList(_config.AddressList, ip);

                        this.BeginInvoke(new Action(() =>
                        {
                            SetStatusBadge(true);
                            if (count > 0)
                            {
                                SetLog("🛑 تم فصل " + ip + " بنجاح وإعادته للإنترنت المباشر العادي!", C_GREEN);
                                MessageBox.Show(string.Format("تم فصل الجهاز {0} بنجاح!\nعاد الجهاز للعمل عبر خط الإنترنت العادي.", ip), "تم الفصل", MessageBoxButtons.OK, MessageBoxIcon.Information);
                            }
                            else
                            {
                                SetLog("ℹ️ لم يتم العثور على الجهاز " + ip + " في قائمة الـ VPN", C_MUTED);
                                MessageBox.Show("الجهاز " + ip + " غير موجود أصلاً في قائمة الـ VPN!", "تنبيه", MessageBoxButtons.OK, MessageBoxIcon.Information);
                            }
                            RefreshActiveListAsync();
                        }));
                    }
                }
                catch (Exception ex)
                {
                    this.BeginInvoke(new Action(() =>
                    {
                        SetStatusBadge(false);
                        SetLog("❌ فشل فصل " + ip + ": " + ex.Message, C_RED);
                        MessageBox.Show("فشل الاتصال بالمايكروتك:\n" + ex.Message, "خطأ", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    }));
                }
                finally
                {
                    this.BeginInvoke(new Action(() =>
                    {
                        btnDisconnectVpn.Enabled = true;
                        btnDisconnectVpn.Text = "🔴 فصل من الـ VPN\n(إزالة من GAMING-VPN)";
                    }));
                }
            });
        }

        private void DisconnectAllAsync()
        {
            var confirm = MessageBox.Show(
                "هل أنت متأكد من رغبتك في فصل جميع الأجهزة من الـ VPN وإعادتها للإنترنت العادي؟",
                "تأكيد فصل كل الأجهزة",
                MessageBoxButtons.YesNo,
                MessageBoxIcon.Question);

            if (confirm != DialogResult.Yes) return;

            btnDisconnectAll.Enabled = false;
            SetLog("جارٍ فصل جميع الأجهزة من الـ VPN بالمايكروتك...", C_ACCENT_BLUE);

            ThreadPool.QueueUserWorkItem(state =>
            {
                try
                {
                    using (var mt = new MikroTikClient(_config.Host, _config.Port, _config.Username, _config.Password))
                    {
                        mt.Connect(3500);
                        int removed = mt.RemoveAllFromAddressList(_config.AddressList);
                        this.BeginInvoke(new Action(() =>
                        {
                            SetStatusBadge(true);
                            SetLog("🧹 تم مسح وفصل " + removed + " جهاز من قائمة الـ VPN بنجاح!", C_GREEN);
                            MessageBox.Show("تم تفريغ قائمة الـ VPN وفصل " + removed + " جهاز بنجاح!", "تم بنجاح", MessageBoxButtons.OK, MessageBoxIcon.Information);
                            RefreshActiveListAsync();
                        }));
                    }
                }
                catch (Exception ex)
                {
                    this.BeginInvoke(new Action(() =>
                    {
                        SetStatusBadge(false);
                        SetLog("❌ فشل فصل الكل: " + ex.Message, C_RED);
                    }));
                }
                finally
                {
                    this.BeginInvoke(new Action(() => { btnDisconnectAll.Enabled = true; }));
                }
            });
        }

        private void RefreshActiveListAsync(bool silent = false)
        {
            if (!silent)
            {
                btnRefreshList.Enabled = false;
                btnRefreshList.Text = "⏳...";
            }

            ThreadPool.QueueUserWorkItem(state =>
            {
                try
                {
                    using (var mt = new MikroTikClient(_config.Host, _config.Port, _config.Username, _config.Password))
                    {
                        mt.Connect(3000);
                        var list = mt.GetAddressList(_config.AddressList);

                        this.BeginInvoke(new Action(() =>
                        {
                            SetStatusBadge(true);
                            lvActiveVpn.Items.Clear();

                            for (int i = 0; i < list.Count; i++)
                            {
                                var item = list[i];
                                string addr = item.ContainsKey("address") ? item["address"] : "-";
                                string comment = item.ContainsKey("comment") ? item["comment"] : "-";
                                string time = item.ContainsKey("creation-time") ? item["creation-time"] : "";

                                var lvi = new ListViewItem(addr);
                                lvi.SubItems.Add(comment);
                                lvi.SubItems.Add(time);
                                lvi.ForeColor = Color.FromArgb(56, 189, 248);
                                lvActiveVpn.Items.Add(lvi);
                            }

                            lblListTitle.Text = string.Format("📋 الأجهزة المتصلة بالـ VPN حالياً في المايكروتك ({0}):", list.Count);
                            if (!silent) SetLog("تم تحديث القائمة بنجاح. الأجهزة المتصلة: " + list.Count, C_MUTED);
                        }));
                    }
                }
                catch (Exception ex)
                {
                    this.BeginInvoke(new Action(() =>
                    {
                        SetStatusBadge(false);
                        if (!silent) SetLog("تعذر الاتصال بالمايكروتك: " + ex.Message, C_RED);
                    }));
                }
                finally
                {
                    if (!silent)
                    {
                        this.BeginInvoke(new Action(() =>
                        {
                            btnRefreshList.Enabled = true;
                            btnRefreshList.Text = "🔄 تحديث";
                        }));
                    }
                }
            });
        }

        private void TestConnectionAsync()
        {
            btnTestConnection.Enabled = false;
            btnTestConnection.Text = "⏳ فحص...";
            SetLog("جارٍ فحص الاتصال بالمايكروتك عبر منفذ " + txtPort.Text + "...", C_ACCENT_BLUE);

            string h = txtHost.Text.Trim();
            int p;
            int.TryParse(txtPort.Text.Trim(), out p);
            string u = txtUser.Text.Trim();
            string pw = txtPass.Text;

            ThreadPool.QueueUserWorkItem(state =>
            {
                var sw = System.Diagnostics.Stopwatch.StartNew();
                try
                {
                    using (var mt = new MikroTikClient(h, p, u, pw))
                    {
                        mt.Connect(3500);
                        string identity = mt.GetSystemIdentity();
                        sw.Stop();

                        this.BeginInvoke(new Action(() =>
                        {
                            SetStatusBadge(true, "🟢 " + identity);
                            SetLog(string.Format("✅ الاتصال ناجح بالراوتر [{0}] خلال {1}ms!", identity, sw.ElapsedMilliseconds), C_GREEN);
                            MessageBox.Show(
                                string.Format("اتصال ناجح بالمايكروتك!\n\nاسم الراوتر: {0}\nالعنوان: {1}:{2}\nزمن الاستجابة: {3}ms", identity, h, p, sw.ElapsedMilliseconds),
                                "اختبار ناجح",
                                MessageBoxButtons.OK,
                                MessageBoxIcon.Information);
                        }));
                    }
                }
                catch (Exception ex)
                {
                    sw.Stop();
                    this.BeginInvoke(new Action(() =>
                    {
                        SetStatusBadge(false);
                        SetLog("❌ فشل اختبار الاتصال: " + ex.Message, C_RED);
                        MessageBox.Show("فشل الاتصال بالمايكروتك:\n" + ex.Message, "فشل الاختبار", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    }));
                }
                finally
                {
                    this.BeginInvoke(new Action(() =>
                    {
                        btnTestConnection.Enabled = true;
                        btnTestConnection.Text = "⚡ اختبار الاتصال";
                    }));
                }
            });
        }

        private void SaveSettings()
        {
            try
            {
                _config.Host = txtHost.Text.Trim();
                int p;
                if (int.TryParse(txtPort.Text.Trim(), out p) && p > 0) _config.Port = p;
                _config.Username = txtUser.Text.Trim();
                _config.Password = txtPass.Text;
                _config.AddressList = txtList.Text.Trim();

                _config.Save();
                SetLog("💾 تم حفظ إعدادات المايكروتك بنجاح في ملف الإعدادات!", C_GREEN);
                MessageBox.Show("تم حفظ الإعدادات بنجاح!", "حفظ", MessageBoxButtons.OK, MessageBoxIcon.Information);
                RefreshActiveListAsync();
            }
            catch (Exception ex)
            {
                MessageBox.Show("فشل حفظ الإعدادات: " + ex.Message, "خطأ", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        // ==========================================
        // PROGRAM ENTRY POINT
        // ==========================================
        [STAThread]
        public static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm());
        }
    }
}
