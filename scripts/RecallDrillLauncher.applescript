set projectPath to "/Users/yuchao/Documents/GitHub/Looplearn-刷记"
set devUrl to "http://127.0.0.1:5173/"
set launchCommand to "cd " & quoted form of projectPath & " && npm run dev -- --host 127.0.0.1 --port 5173"

try
	do shell script "lsof -iTCP:5173 -sTCP:LISTEN -n -P >/dev/null 2>&1"
on error
	tell application "Terminal"
		activate
		do script launchCommand
	end tell
	delay 1.5
end try

do shell script "open " & quoted form of devUrl
