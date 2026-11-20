// The tests' stand-in for the CLI on Windows, where the product starts it as an .exe with no shell.
// cli-stub.mjs compiles this with the .NET Framework C# compiler into its temp folder. launch.txt next to
// the .exe names node (first line) and the stub script (second line). Every argument is passed on
// unchanged; stdin, stdout, stderr, the environment and the exit code pass through as they are.
using System;
using System.Diagnostics;
using System.IO;
using System.Text;

static class Launcher {
  // Quote one argument so CommandLineToArgvW (and node's own reading of its command line) gives it back exactly:
  // backslashes count only before a quote or at the end, and an empty argument still needs its quotes.
  static string Quote(string arg) {
    if (arg.Length > 0 && arg.IndexOfAny(new[] { ' ', '\t', '\n', '\v', '"' }) < 0) return arg;
    var quoted = new StringBuilder("\"");
    int slashes = 0;
    foreach (char c in arg) {
      if (c == '\\') { slashes++; continue; }
      quoted.Append('\\', c == '"' ? slashes * 2 + 1 : slashes);
      quoted.Append(c);
      slashes = 0;
    }
    quoted.Append('\\', slashes * 2);
    quoted.Append('"');
    return quoted.ToString();
  }

  static int Main(string[] args) {
    string[] launch = File.ReadAllLines(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "launch.txt"));
    var line = new StringBuilder(Quote(launch[1]));
    foreach (string arg in args) line.Append(' ').Append(Quote(arg));
    var start = new ProcessStartInfo(launch[0], line.ToString()) { UseShellExecute = false };
    using (Process child = Process.Start(start)) {
      child.WaitForExit();
      return child.ExitCode;
    }
  }
}
