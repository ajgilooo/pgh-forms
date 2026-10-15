"""Map the official September 2018 CF-2, in its original 612 x 936 pt layout.

Source: https://www.philhealth.gov.ph/downloads/claim/ClaimForm2_092018.pdf
All coordinates use a top-left origin. No certification or consent is selected.
"""
import json
from pathlib import Path

fields=[]
def f(id,name,page,x,y,w,h=13,kind='text',group='Additional details',binding='manual',font=8,**meta):
    fields.append(dict(id=id,name=name,page=page,x=x,y=y,width=w,height=h,kind=kind,group=group,binding=binding,fontSize=font,uppercase=True,**meta))
def check(id,name,page,x,y,group,exclusive=None,**meta):
    f(id,name,page,x,y,12.27,12.27,'checkbox',group,**({'exclusiveGroup':exclusive} if exclusive else {}),**meta)
def date(id,name,page,x,y,group):
    for part,offset,width in [('month',0,24.58),('day',31.71,24.58),('year',63.39,49.18)]:
        f(id+'-'+part,name,page,x+offset,y,width,12,group=group,valueKey=id,inputType='date',format='date-'+part,cells=4 if part=='year' else 2)
def fulldate(id,name,page,x,y,w,group):
    f(id,name,page,x,y,w,12,group=group,inputType='date',format='date-full',font=7)
def time(id,name,page,x,y,amx,amy,pmx,group):
    f(id+'-hour',name,page,x,y,24.58,12,group=group,valueKey=id,inputType='time',format='time-hour',cells=2)
    f(id+'-minute',name,page,x+31.71,y,24.58,12,group=group,valueKey=id,inputType='time',format='time-minute',cells=2)
    check(id+'-am',name,page,amx,amy,group,valueKey=id,format='time-am')
    check(id+'-pm',name,page,pmx,amy,group,valueKey=id,format='time-pm')
def characters(id,name,page,xs,y,h,group):
    for i,x in enumerate(xs):
        f(id+f'-{i}',name,page,x,y,11.85,h,group=group,valueKey=id,characterIndex=i,characterCount=len(xs),font=8)

hci='Part I · Health care institution'
characters('series','Series number',0,[432.87,444.74,456.55,468.43,480.3,492.11,504.06,515.93,527.74,539.75,551.63,563.43,575.51],101.96,11.85,hci)
characters('hci-pan','HCI PhilHealth accreditation number (9 characters)',0,[330.25,342.54,354.79,367.08,379.33,391.63,403.88,416.17,428.42],192.59,12.27,hci)
f('hci-name','Name of health care institution',0,175,207,412,group=hci)
f('hci-street','HCI building / street',0,81,224,205,group=hci)
f('hci-city','HCI city / municipality',0,296,224,144,group=hci)
f('hci-province','HCI province',0,452,224,135,group=hci)

name='Part II · Patient name'
f('patient-last','Patient last name',0,125,271,110,group=name,binding='patient.lastName')
f('patient-first','Patient first name',0,247,271,120,group=name,binding='patient.firstName')
f('patient-extension','Name extension (JR/SR/III)',0,376,271,82,group=name)
f('patient-middle','Patient middle name',0,470,271,117,group=name,binding='patient.middleName')

g='Part II · Referral and confinement'
check('referral-no','Referred by another HCI — no',0,32.51,329.38,g,'Referred by another HCI')
check('referral-yes','Referred by another HCI — yes',0,70.31,329.38,g,'Referred by another HCI')
for id,label,x,w in [('name','Referring HCI name',112,148),('street','Referring HCI building / street',271,113),('city','Referring HCI city / municipality',396,65),('province','Referring HCI province',470,72),('zip','Referring HCI ZIP code',551,36)]:
    f('referring-'+id,label,0,x,327,w,group=g,font=7)
date('admitted-date','Date admitted',0,197.99,357.5,g)
time('admitted-time','Time admitted',0,391.34,357.5,471.11,360.35,513.16,g)
date('discharged-date','Date discharged',0,197.99,373.3,g)
time('discharged-time','Time discharged',0,391.34,373.3,471.11,375.52,513.16,g)
for id,label,x,y in [('improved','Improved',32.51,407.44),('recovered','Recovered',32.51,422.49),('hama','Home / discharged against medical advice',32.51,437.54),('absconded','Absconded',32.51,452.58),('expired','Expired',190.45,407.44),('transferred','Transferred / referred',190.45,422.49)]:
    check('disposition-'+id,'Disposition — '+label,0,x,y,g,'Patient disposition')
date('expired-date','Date expired',0,259.05,403.6,g)
time('expired-time','Time expired',0,419.97,404.8,493.6,407.51,525.32,g)
for id,label,x,w in [('name','Referral / transfer HCI name',292,294),('street','Transfer HCI building / street',271,113),('city','Transfer HCI city / municipality',396,65),('province','Transfer HCI province',470,72),('zip','Transfer HCI ZIP code',551,36)]:
    f('transfer-'+id,label,0,x,420 if id=='name' else 435,w,group=g,font=7)
f('transfer-reason','Reason for referral / transfer',0,320,454,266,group=g,font=7)
check('accommodation-private','Accommodation — private',0,144.02,468.04,g,'Accommodation')
check('accommodation-nonprivate','Accommodation — non-private / charity / service',0,198.47,468.04,g,'Accommodation')

g='Part II · Diagnoses and procedures'
f('admission-diagnosis','Admission diagnoses',0,32,500,554,16,'multiline',g,font=8)
for diagnosis,y in [('a',549),('b',589.5)]:
    f('diagnosis-'+diagnosis,'Discharge diagnosis '+diagnosis,0,43,y,70,39,'multiline',g,font=8)
    f('icd-'+diagnosis,'ICD-10 codes for diagnosis '+diagnosis,0,125,y,55,39,'multiline',g,font=7)
for row,y in enumerate([549,562.5,576,589.5,603,616.4],1):
    prefix=f'Procedure {row}'
    f(f'procedure-{row}',prefix+' description',0,201,y,113,12,group=g,font=7)
    f(f'rvs-{row}',prefix+' RVS code',0,326,y,60,12,group=g,font=7)
    fulldate(f'procedure-date-{row}',prefix+' date',0,396,y,62,g)
    for side,x in [('left',473.33),('right',508.91),('both',548.04)]:check(f'laterality-{row}-{side}',prefix+' — '+side,0,x,y+1.23,g,f'Procedure {row} laterality')

g='Part II · Special considerations'
for id,label,x,y,tx,w in [('hemodialysis','Hemodialysis',41.76,664.19,151,149),('peritoneal','Peritoneal dialysis',41.76,679.31,151,149),('linac','Radiotherapy (LINAC)',41.76,694.43,151,149),('cobalt','Radiotherapy (COBALT)',41.76,709.55,151,149),('transfusion','Blood transfusion',317.88,664.19,423,148),('brachytherapy','Brachytherapy',317.88,679.31,423,148),('chemotherapy','Chemotherapy',317.88,694.43,423,148),('debridement','Simple debridement',317.88,709.55,423,148)]:
    check(id,label,0,x,y,g);f(id+'-dates',label+' dates (MM-DD-YYYY)',0,tx,y-1,w,12,group=g,font=7)
f('z-code','Z-benefit package code',0,277,723,160,12,group=g)
for i,x in enumerate([50,199,334,459],1):fulldate(f'prenatal-{i}',f'Prenatal check-up {i}',0,x,752,116 if i<4 else 128,g)
check('tb-intensive','TB DOTS — intensive phase',0,130.07,769.31,g,'TB DOTS phase')
check('tb-maintenance','TB DOTS — maintenance phase',0,225.47,769.31,g,'TB DOTS phase')
for id,label,x,w in [('arv0','Day 0 ARV',80,63),('arv3','Day 3 ARV',189,71),('arv7','Day 7 ARV',310,59),('rig','RIG',393,66)]:fulldate(id,label+' date',0,x,798,w,g)
f('vaccine-other','Other vaccine / dose details',0,530,798,58,12,group=g,font=7)
for id,label,x,y in [('essential','Essential newborn care',149.44,813.96),('hearing','Newborn hearing screening',244.12,813.96),('screening','Newborn screening test',371.02,813.96),('drying','Immediate drying',41.76,844.75),('skin','Early skin-to-skin contact',41.76,859.16),('cord','Timely cord clamping',162.8,844.75),('eye','Eye prophylaxis',162.8,859.16),('weigh','Weighing',264.4,844.75),('vitamin-k','Vitamin K administration',264.4,859.16),('bcg','BCG vaccination',376.64,844.75),('breastfeeding','Non-separation / early breastfeeding',376.64,859.16),('hep-b','Hepatitis B vaccination',471.32,845.45)]:check('newborn-'+id,label,0,x,y,g)
f('hiv-lab','Outpatient HIV/AIDS laboratory number',0,291,870,141,12,group=g)
f('first-case','First case rate ICD-10 / RVS code',0,172,903,172,12,group=g)
f('second-case','Second case rate ICD-10 / RVS code',0,426,903,160,12,group=g)

g='Part II · Accredited health care professionals'
panxs=[99.7,112.02,124.3,136.61,155.98,168.29,180.57,192.88,205.16,217.48,229.76,249.17]
for n,py,ny,dy,cy in [(1,67.12,81,107.5,82.9),(2,134.83,143.5,168.9,145.64),(3,196.17,205,230.4,207.11)]:
    characters(f'professional-{n}-pan',f'Professional {n} accreditation number (12 characters)',1,panxs,py-2,12,g)
    f(f'professional-{n}-name',f'Professional {n} printed name (sign separately)',1,57,ny,234,12,group=g)
    date(f'professional-{n}-date',f'Professional {n} date signed',1,125.49,dy,g)
    check(f'professional-{n}-no-copay',f'Professional {n} — no co-pay',1,332.53,cy,g,f'Professional {n} co-pay')
    check(f'professional-{n}-copay',f'Professional {n} — with co-pay',1,332.53,cy+14.4,g,f'Professional {n} co-pay')
    f(f'professional-{n}-amount',f'Professional {n} co-pay amount',1,494,cy+13,86,12,group=g)

g='Part III · Benefits and charges'
check('benefit-enough','Benefit enough to cover HCI and professional charges; no patient purchases / co-pay',1,34.16,308.06,g,'Certification of benefit consumption')
check('benefit-copay','Benefit consumed before co-pay, or purchases / expenses despite remaining benefit',1,34.16,392.31,g,'Certification of benefit consumption')
for id,label,y in [('hci','Total HCI actual charges',345),('professional','Total professional actual charges',360),('grand','Grand total actual charges',375)]:f('charges-'+id,label,1,324,y,233,12,group=g)
for id,label,y,amountY,checkY in [('hci','HCI fees',483,470,494.11),('professional','Professional fees',530,518,541.59)]:
    for key,col,x,w in [('actual','actual charges',135,75),('discount','amount after discount',217,101),('benefit','PhilHealth benefit',324,91)]:f(f'copay-{id}-{key}',label+' — '+col,1,x,y,w,15,group=g)
    f(f'copay-{id}-amount',label+' — amount after PhilHealth deduction',1,462,amountY,90,12,group=g)
    for key,who,x,dy in [('patient','member / patient',423.98,0),('hmo','HMO',498.5,0),('other','other',423.98,10.63)]:
        f(f'payer-{id}-{key}',label+' paid by '+who,1,x,checkY+dy,9.21,9.21,'checkbox',g)
for id,label,y in [('drugs','Outside HCI drugs / medical supplies',589.07),('diagnostics','Outside HCI diagnostics / laboratory expenses',615.29)]:
    f(f'outside-{id}-none',label+' — none',1,359.93,y,9.21,9.21,'checkbox',g,exclusiveGroup='Outside '+id+' purchases')
    f(f'outside-{id}-has-amount',label+' — has amount',1,419.78,y,9.21,9.21,'checkbox',g,exclusiveGroup='Outside '+id+' purchases')
    f(f'outside-{id}-amount',label+' total amount',1,493,y-5,59,13,group=g)

g='Part III · Consent details (sign separately)'
f('consent-name','Member / patient / authorized representative printed name',1,32,719,281,13,group=g)
date('consent-date','Consent date signed',1,125.49,749.5,g)
for id,label,x,y in [('spouse','Spouse',160.1,780.24),('child','Child',205.53,780.24),('parent','Parent',247.42,780.24),('sibling','Sibling',160.1,791.51),('other','Other',205.53,791.51)]:f('relationship-'+id,'Representative relationship — '+label,1,x,y,9.21,9.21,'checkbox',g,exclusiveGroup='Representative relationship')
f('relationship-other-text','Other representative relationship',1,271,786,74,13,group=g,font=7)
for id,label,y in [('incapacitated','Patient is incapacitated',804.9),('other','Other reason',816.17)]:f('consent-reason-'+id,'Reason for representative — '+label,1,160.1,y,9.21,9.21,'checkbox',g,exclusiveGroup='Representative signing reason')
f('consent-reason-text','Other reason for representative signing',1,224,811,121,13,group=g,font=7)
f('signer-patient','Signer — patient',1,357.01,805.61,9.21,9.21,'checkbox',g,exclusiveGroup='Consent signer')
f('signer-representative','Signer — representative',1,357.01,816.88,9.21,9.21,'checkbox',g,exclusiveGroup='Consent signer')
g='Part IV · HCI certification details (sign separately)'
f('hci-representative','Authorized HCI representative printed name',1,32,878,207,13,group=g)
f('hci-designation','Official capacity / designation',1,247,878,164,13,group=g)
date('hci-signed','HCI certification date signed',1,470.05,880,g)

assert len({f['id'] for f in fields})==len(fields)
Path('src/data/cf2-fields.json').write_text(json.dumps(fields,ensure_ascii=False,indent=2)+'\n')
print(len(fields),'mapped fields;',len({f.get('valueKey',f['id']) for f in fields if f['binding']=='manual'}),'manual inputs')
