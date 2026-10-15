"""Publish to the specifically requested GitHub repository using Git's credential helper.

Credentials remain in process memory and are sent only to api.github.com. This
helper never writes or prints them. Run from the project root.
"""
import json, os, subprocess, sys, urllib.request, urllib.error

REPO='ajgilooo/pgh-forms'
def main():
    action=sys.argv[1] if len(sys.argv)>1 else 'status'
    credentials=subprocess.run(['git','credential','fill'],input='protocol=https\nhost=github.com\n\n',text=True,capture_output=True,env={**os.environ,'GIT_TERMINAL_PROMPT':'0'},timeout=20)
    pairs=dict(line.split('=',1) for line in credentials.stdout.splitlines() if '=' in line)
    token=pairs.get('password')
    if not token:
        print('No GitHub credential is available through the configured Git helper.');return 2
    def api(path,method='GET',payload=None):
        req=urllib.request.Request('https://api.github.com'+path,method=method,data=None if payload is None else json.dumps(payload).encode(),headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'PGH-Forms-deployment','Content-Type':'application/json'})
        try:
            with urllib.request.urlopen(req,timeout=30) as r:
                body=r.read();return json.loads(body) if body else {}
        except urllib.error.HTTPError as e:
            detail=json.loads(e.read()).get('message','Request failed')
            raise RuntimeError(f'GitHub {e.code}: {detail}') from None
    user=api('/user')
    if user['login']!='ajgilooo':
        print('The configured Git credential belongs to a different account; no repository changes were made.');return 2
    if action=='create':
        try: repo=api('/repos/'+REPO)
        except RuntimeError as e:
            if 'GitHub 404:' not in str(e):raise
            repo=api('/user/repos','POST',{'name':'pgh-forms','description':'Browser-only PGH form filling, specimen grouping, and copyable tube labels. Patient data stays in the current session.','private':False,'auto_init':False})
        print(json.dumps({'repository':repo['html_url'],'visibility':repo['visibility']}))
    elif action=='enable':
        try: pages=api('/repos/'+REPO+'/pages')
        except RuntimeError as e:
            if 'GitHub 404:' not in str(e):raise
            pages=api('/repos/'+REPO+'/pages','POST',{'build_type':'workflow'})
        if pages.get('build_type')!='workflow':pages=api('/repos/'+REPO+'/pages','PUT',{'build_type':'workflow'})
        print(json.dumps({'url':pages.get('html_url'),'build_type':pages.get('build_type'),'status':pages.get('status')}))
    elif action=='status':
        pages=api('/repos/'+REPO+'/pages');runs=api('/repos/'+REPO+'/actions/runs?per_page=3')
        print(json.dumps({'url':pages.get('html_url'),'pages_status':pages.get('status'),'runs':[{'id':r['id'],'status':r['status'],'conclusion':r['conclusion'],'url':r['html_url'],'head_sha':r['head_sha']} for r in runs.get('workflow_runs',[])]},indent=2))
    elif action=='logs':
        runs=api('/repos/'+REPO+'/actions/runs?per_page=1');run=runs['workflow_runs'][0]
        jobs=api('/repos/'+REPO+f"/actions/runs/{run['id']}/jobs")
        print(json.dumps([{'name':j['name'],'conclusion':j['conclusion'],'steps':[{'name':s['name'],'conclusion':s['conclusion']} for s in j.get('steps',[])]} for j in jobs['jobs']],indent=2))
    return 0

if __name__=='__main__':
    try:sys.exit(main())
    except Exception as e:print(str(e));sys.exit(1)
