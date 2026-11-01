Set WshShell = CreateObject("WScript.Shell")
strPath = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
WshShell.Run """" & strPath & "START-CLIENT.bat""", 0, False
Set WshShell = Nothing
