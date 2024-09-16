import os
import subprocess
import re

def get_git_log():
    try:
        result = subprocess.run(['git', 'log', '--pretty=format:%h %ad %s', '--date=short'], capture_output=True, text=True, check=True)
        return result.stdout
    except subprocess.CalledProcessError as e:
        print(f"Error: {e}")
        return ""

def parse_commits(log):
    commits = []
    for line in log.split('\n'):
        match = re.match(r'(\w+) (\d{4}-\d{2}-\d{2}) (.+)', line)
        if match:
            commit = {
                'hash': match.group(1),
                'date': match.group(2),
                'message': match.group(3)
            }
            commits.append(commit)
    return commits

def generate_changelog(commits):
    with open('CHANGELOG.md', 'w') as f:
        f.write('# Changelog\n\n')
        for commit in commits:
            f.write(f"## {commit['date']}\n")
            f.write(f"- {commit['message']} ({commit['hash']})\n\n")

def main():
    log = get_git_log()
    if log:
        commits = parse_commits(log)
        generate_changelog(commits)
        print('CHANGELOG.md has been generated.')
    else:
        print('No git log available.')

if __name__ == '__main__':
    main()
