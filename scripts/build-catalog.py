"""Curate the supplied Telegram export into deterministic, source-linked rules.

Unknown specimen/container requirements intentionally remain unresolved. This is
source transcription, not an independently verified laboratory protocol.
"""
import json, re, unicodedata
from pathlib import Path

sources = json.loads(Path('src/data/sources.json').read_text())
source = {m['id']: m for m in sources}
tests = []

def between(message, start, end):
    text = source[f'message{message}']['text']
    return text.split(start, 1)[1].split(end, 1)[0].strip()

def add(names, lab, section, specimen, container, message, requirements='', **flags):
    for line in names.strip().splitlines():
        line = line.strip()
        if not line: continue
        parts = line.split('|')
        name, aliases = parts[0].strip(), [a.strip() for a in parts[1:]]
        id = re.sub(r'[^a-z0-9]+', '-', unicodedata.normalize('NFKD',f'{lab}-{section}-{specimen}-{name}').encode('ascii','ignore').decode().lower()).strip('-')
        if any(t['id'] == id for t in tests): continue
        tests.append(dict(id=id, name=name, aliases=aliases, lab=lab, section=section, specimen=specimen, container=container, requirements=requirements, sourceIds=[f'message{m}' for m in ([message] if isinstance(message,int) else message)], **flags))

CHEM='Clinical Chemistry'; MICROSCOPY='Clinical Microscopy'; HEM='Hematology'; IMM='Immunopathology'; MICRO='Microbiology'; CENTRAL='Central Lab'

add('''Total PSA|PSA|Prostate-Specific Antigen, Total
Total PSA, diluted
Basic Electrolytes Panel|Electrolytes|Na K Cl
Lipid Profile|Lipids
Liver Function Test Panel|LFT|LFTs
OGCT, 50 grams|OGCT
OGTT, 100 grams|OGTT 100
OGTT, 75 grams|OGTT 75
Chloride|Cl|CI
Calcium, serum|Ca|Serum calcium
Magnesium|Mg
Phosphorus|PO4|Phosphate
Potassium, serum|K|Serum K
Sodium|Na
Albumin
Alkaline Phosphatase|ALP
ALT|SGPT
Amylase
AST|SGOT
Bilirubin, direct - adult|DB|DBil|Direct bilirubin
Bilirubin, indirect - adult|IB|IBil|Indirect bilirubin
Bilirubin, total - adult|TB|TBil|Total bilirubin
Bilirubin, neonatal|Neonatal bilirubin
BUN|Blood urea nitrogen
Creatinine|Crea
Glucose|Sugar|FBS|RBS
GGT|Gamma-glutamyl transferase
LDH|Lactate dehydrogenase
Lipase
LDL, direct|LDL
Pre-albumin
HDL
Triglycerides|TG
Total cholesterol|Cholesterol
Total Carbon Dioxide|TCO2
Total Protein
TPAG/Globulin|TPAG|Albumin globulin ratio
Uric Acid|UA
CK-Total|CK|Creatine kinase
CK-MB
hsCRP|High sensitivity CRP
NT-proBNP|NTproBNP
Troponin I, quantitative|Trop I|Troponin I
Rapid Anti-HCV, qualitative|Rapid anti HCV
Rapid HBsAg, qualitative|Rapid HBsAg
COVID Total Antibody
COVID IgG Antibody
Alcohol
Acetaminophen|Paracetamol assay
Phenobarbital
Lithium
Salicylates
Valproic Acid|Valproate
Vancomycin
dTIBC|TIBC|Direct total iron binding capacity
Ferritin
Serum Iron|Iron
Serum Protein Electrophoresis|SPEP
Immunotyping|Immunosubtraction''',CENTRAL,CHEM,'Blood','red',7,'Source default: red top, 1–2 mL. Combined tests may require more; do not add volumes automatically.')
add('HbA1c|Glycated hemoglobin',CENTRAL,CHEM,'Blood','purple',7,'2 mL using the 2 mL purple top.')
add('''Potassium, plasma|Plasma K
Ionized Calcium, plasma|iCa|Ionized calcium
Ammonia''',CENTRAL,CHEM,'Blood','green',7,'Fill to black line (4 mL). Green-top tests must be separated.',dedicated=True)
add('G6PD, quantitative|G6PD',CENTRAL,CHEM,'Blood','purple',7,'EDTA vial; source explicitly requires a separate vial. Confirm volume.',dedicated=True,needsReview=True)
add('Hemoglobin Electrophoresis|Hb electrophoresis',CENTRAL,CHEM,'Blood','purple',[7,16],'2 mL purple top. Tue/Thu 8–9 AM. Requires CBC (≤3 days), ferritin, iron and dTIBC results; no transfusion in last 3 months.',dedicated=True)
add('Hemoglobin Electrophoresis Package|Hb electrophoresis package',CENTRAL,CHEM,'Blood','unknown',[7,16],'Package includes electrophoresis, dTIBC, ferritin and serum iron. Requires multiple specimen requirements; split into component orders after confirmation.',needsReview=True,dedicated=True)
for t in tests:
    if t['name']=='Lipid Profile': t['requirements']+=' Source records 12 hours fasting.'
    if t['name'].startswith('OG'):
        t['requirements']+=' Source records 8 hours fasting; confirm timing and collection schedule.'
        t.update(needsReview=True,dedicated=True)
    if t['name']=='Glucose': t['requirements']+=' FBS requires 8 hours fasting in source; specify FBS or RBS in order notes.'
    if t['name']=='Total Carbon Dioxide': t['requirements']='Red top, fill to black line (4 mL).'
    if t['name']=='Valproic Acid': t['requirements']='Call Chemistry 3212 before submission; extract 30 minutes before next dose; red top 2 mL, room temperature.'
    if t['name']=='Serum Protein Electrophoresis': t.update(dedicated=True,requirements='Source: Tue/Thu 8–9 AM; inform Chemistry 3212 the day before. Requires serum total protein result; fasting ≥6 hours; no beta lactams or contrast in prior 3 days; no anticoagulant treatment in prior 24 hours. Source records reader fee ₱200 and relative brings sample. Confirm instructions with lab; do not change treatment from this app.',sourceIds=['message7','message16'])

add('''CSF Albumin
CSF Cholesterol
CSF Creatinine
CSF LDH
CSF Sugar|CSF glucose
CSF Total Protein
CSF Total Protein/Sugar|CSF quanti
CSF Triglycerides''',CENTRAL,CHEM,'CSF','cup',[7,27],'Source: at least 3 mL; compatible Chemistry CSF tests share one cup.')
add('''Urine Amylase
Urine Calcium|Urine Ca
Urine Chloride|Urine Cl
Urine Creatinine|Urine crea
Urine Magnesium, 24-hour|24h urine magnesium
Urine Microalbumin|Urine mAlb
Urine Phosphorus|Urine PO4
Urine Potassium|Urine K
Urine Sodium|Urine Na
Urine Glucose, quantitative|Urine sugar quanti
Urine Total Protein
Urine Urea Nitrogen
Urine Uric Acid''',CENTRAL,CHEM,'Urine','unknown',7,'Urine specimen listed; collection container/volume not fully specified. Confirm with lab.',needsReview=True)
add('Urine Protein Electrophoresis|UPEP',CENTRAL,CHEM,'Urine','cup',[7,16],'Source: Mon/Wed/Fri. Obtain container from Central Labs; 60 mL first-morning urine. Obtain alongside urine total protein, two separate cups total. Call Chemistry 3212 one day before; confirm requirements.',dedicated=True,needsReview=True)
add('''Urinalysis|UA urine|Routine urinalysis
Pregnancy Test, urine|Urine PT|UPT
Urine Albumin, qualitative
Urine Bilirubin
Urine Hemoglobin
Urine Ketone
Urine Leukocyte
Urine Myoglobin
Urine Nitrite
Urine pH
Urine RBC Morphology
Urine Sugar, qualitative
Urine Specific Gravity
Urine Urobilinogen''',CENTRAL,MICROSCOPY,'Urine','unknown',8,'Source lists urine specimen; confirm container and collection requirements. Urine myoglobin minimum: 15 mL.',needsReview=True)
add('''CSF Qualitative|CSF quali|CSF cell count and differential
CSF RBC Count
CSF Specific Gravity
CSF Direct Wet Mount
CSF RBC Morphology
CSF pH''',CENTRAL,MICROSCOPY,'CSF','cup',[8,27],'Compatible Clinical Microscopy CSF tests share one cup in source.')
add('''Direct Wet Mount
Qualitative, other body fluid|Body fluid quali
RBC Morphology, other body fluid
pH, other body fluid
Specific Gravity, other body fluid''',CENTRAL,MICROSCOPY,'Other body fluid','unknown',8,'Specify the complete specimen name and confirm collection container.',needsReview=True)
add('Seminalysis',CENTRAL,MICROSCOPY,'Semen','unknown',8,'Confirm collection container and requirements.',needsReview=True)
add('''Direct Fecal Smear with Concentration|DFS|Fecal concentration technique
Crypto/Giardia Antigen
Clostridium difficile Antigen|C difficile antigen
E. histolytica Antigen
Rotavirus Antigen
Fecal Immunochemical Test|FIT
Fecal Occult Blood, guaiac|FOBT''',CENTRAL,MICROSCOPY,'Stool','unknown',8,'Confirm stool container and submission requirements.',needsReview=True)
add('Test for Crystals, synovial fluid|Synovial crystals',CENTRAL,MICROSCOPY,'Synovial fluid','unknown',8,'Confirm collection container and requirements.',needsReview=True)
add('''Vaginal Washing Analysis for Sperm Cells
Ferning Test''',CENTRAL,MICROSCOPY,'Vaginal fluid','unknown',8,'Confirm collection container and requirements.',needsReview=True)

add('''Complete Blood Count|CBC
Reticulocyte Count|Retic
Peripheral Blood Smear|PBS|RBC WBC morphology
Differential Count
Hematocrit|Hct
Hemoglobin|Hb|Hgb
Platelet Count|Platelets
Erythrocyte Sedimentation Rate|ESR
Filarial Smear
Malarial Smear''',CENTRAL,HEM,'Blood','purple',9,'Purple top, 2 mL. Same-section compatible purple-top tests may share a tube.')
add('''Activated Partial Thromboplastin Time|aPTT
Partial Thromboplastin Time|PTT
Prothrombin Time|PT|PT INR
Bleeding Time|BT
Clot Retraction Time|CRT
Clotting Time|CT''',CENTRAL,HEM,'Blood','blue',9,'Listed under clotting parameters: blue top, filled to black line (4 mL). Confirm applicability for procedural tests.')
add('Fibrinogen|Factor I',CENTRAL,HEM,'Blood','blue',[9,24],'Blue top, filled to black line.')
add('''Factor VIII|Factor 8
Factor IX|Factor 9
Silica Clotting Time|SCT
D-Dimer|D dimer
Protein C
Protein S
LE Cell Preparation
DRVVT Screen|DRWVT screen
Lupus/DRVVT Confirmatory|Lupus DRWVT confirmatory''',CENTRAL,HEM,'Blood','unknown',9,'Tube requirement not explicit in supplied entry; confirm. Factor IX noted unavailable as of 3/4/23, not a current availability claim.',needsReview=True)

add('''C-Reactive Protein|CRP
CA-125|CA125
CA-125, diluted
Beta-hCG, total undiluted|bHCG|Beta HCG
Beta-hCG, diluted
AFP Qualitative
AFP Quantitative|AFP
Anti-Mullerian Hormone|AMH
CA 15-3
CA 19-9
CA 19-9, diluted
CEA
CEA, diluted
DHEA-S|DHEAS
Estradiol
Follicle Stimulating Hormone|FSH
HE 4|HE4
Insulin
Luteinizing Hormone|LH
Procalcitonin|PCT
Progesterone
Prolactin
Rheumatoid Factor|RF
Sex Hormone Binding Globulin|SHBG
Testosterone
Thyroid Stimulating Hormone|TSH
Free T3|FT3|T3 free
Free T4|FT4|T4 free
MMR Panel
Anti-Streptococcal O|ASO
CMV IgG
CMV IgM
Dengue IgG/IgM
Dengue NS1 Antigen|NS1
EBV IgG
EBV IgM
HSV 1 IgG
HSV 2 IgG
H. pylori IgG
Leptospira IgG/IgM, rapid|Lepto rapid
Mumps IgG
RPR Qualitative|RPR
RPR Quantitative
Salmonella IgG/IgM
Syphilis CMIA
Toxoplasma IgG
Toxoplasma IgM
Rubella IgM
Rubella IgG
Rubeola IgG|Measles IgG
Varicella IgG
Interleukin-6|IL6|IL-6
Cyclosporine
Sirolimus''',CENTRAL,IMM,'Blood','red',10,'Red top, 3 mL source default. Confirm volume when combining tests.')
add('''Full Hepatitis Profile
Hepatitis B Profile
Anti-HAV IgM
Anti-HBc Total
Anti-HBc IgM
Anti-HBe
Anti-HBs
Anti-HCV
HBeAg
HBsAg
TORCH Panel
HIV Combi Ag/Ab|HIV Ag Ab''',CENTRAL,IMM,'Blood','red',[10,21],'Source entries differ: March entry lists hepatitis/TORCH/HIV at 5 mL; August entry says hepatitis ~3 mL except full profile 5 mL. Confirm requirements.',needsReview=True)
add('Tacrolimus',CENTRAL,IMM,'Blood','purple',10,'Purple top exception. Confirm required volume.',needsReview=True)
add('''Anti-smooth muscle antibody|ASMA
Anti-liver kidney microsomal antibody|Anti-LKM|Anti LKM 1|Anti-LKM-1''',CENTRAL,IMM,'Blood','red',[10,30],'May share one red top, but each test requires a separate paper request.',separateRequest=True)
add('Interferon Gamma Release Assay|IGRA',CENTRAL,IMM,'Blood','special',10,'Obtain four special tubes from Immunopathology.',dedicated=True,options=[dict(name='Four special IGRA tubes',parts=[dict(container='special',count=4,instruction='Obtain the four-tube set from Immunopathology.')])])
add('''CSF Bactigen
CSF CALAS
CSF Rubeola IgG|CSF Measles IgG''',CENTRAL,IMM,'CSF','unknown',10,'Minimum 3 mL; confirm container and compatibility.',needsReview=True)

add('''Acid-Fast Bacilli Stain|AFB
Acid-Fast Bacilli Stain, modified|Modified AFB
AFB Culture and Sensitivity|AFB CS|TB CS
Anaerobic Culture
Blood Culture and Sensitivity|Blood CS|Blood culture
Catheter Tip Culture, MAKI|Catheter tip CS
Conjunctival/Corneal Scraping
Exudate Gram Stain/Culture|Exudate GSCS
Fungal Culture|Fungal CS
MAKI Environmental Culture
Milk Bank Culture
Respiratory Tract Gram Stain/Culture|Respiratory GSCS
Stool/Rectal Swab Culture|Stool GSCS
Gram Stain|GS
India Ink
KOH Mount
MRSA Screening
Trichomonas Monilia Gram Stain|TMG smear
TPN Analysis
C. difficile Real-time PCR|C diff PCR
C. trachomatis Real-time PCR|C trachomatis PCR''',CENTRAL,MICRO,'','unknown',11,'Always specify specimen and site/source; confirm container and collection requirements.',needsReview=True)
add('Sputum TB PCR|Sputum GeneXpert|Sputum MTB RIF',CENTRAL,MICRO,'Sputum','unknown',[11,22],'Only sputum TB PCR is listed at Central Lab; other specimens route to MRL. Confirm container.',needsReview=True)
add('Urine Gram Stain/Culture|Urine GSCS|Urine culture',CENTRAL,MICRO,'Urine','unknown',11,'Specify site/source and confirm collection container.',needsReview=True)
add('CSF Gram Stain/Culture|CSF GSCS',CENTRAL,MICRO,'CSF','cup',[11,27],'Compatible CSF Microbiology tests share one cup. Specify specimen source.')

add('''Blood Typing|ABO RH|ABO Rh typing
Direct Coombs|DAT
Indirect Coombs|IAT
Antibody Screening
Immediate Spin Crossmatching
Routine Crossmatching|Crossmatch''','Blood Bank','Blood Bank','Blood','purple',12,'Purple top, 2 mL; more may be needed for multiple tests.')
add('''Packed Red Blood Cells|PRBC|pRBC
PRBC, aliquot
Leukoreduced PRBC
Leukoreduced PRBC, aliquot
Platelet Concentrate|PC
Leukoreduced Platelet Concentrate
Fresh Frozen Plasma|FFP
Cryoprecipitate|Cryo
Cryosupernate
Whole Blood
Plateletpheresis
Therapeutic Plasma Exchange|Plasmapheresis
Autologous Donation''','Blood Bank','Blood Bank','','unknown',12,'Blood product/procedure request, not an ordinary tube order. Confirm specimen needs and upload the appropriate Blood Bank form.',needsReview=True,dedicated=True)

nuclear=[('Free Thyroxine|FT4|Free T4','Every day'),('Thyroid Stimulating Hormone|TSH','Every day'),('Free Triiodothyronine|FT3|Free T3','Mon/Wed/Fri'),('Cortisol','Mon/Wed/Fri; fasting 8–12 hours'),('Prolactin','Mon/Wed/Fri'),('25-Hydroxy Vitamin D|Vitamin D','Mon/Wed'),('Parathyroid Hormone|PTH','Mon/Wed'),('Human Chorionic Gonadotropin|HCG','Mon/Thu'),('17-alpha-Hydroxyprogesterone|17 OHP','Mon/Thu'),('Antithyroglobulin Antibody|Anti Tg','Tue/Thu'),('Anti-thyroid Peroxidase Antibody|TPO','Tue/Thu'),('Testosterone','Tue/Thu'),('Thyroglobulin|Tg','Tue/Thu'),('DHEA-S|DHEAS','Monday'),('TSH Receptor Antibody|TRAB','Last Monday of month'),('Growth Hormone|hGH','Tuesday; fasting 8–12 hours'),('Insulin-like Growth Factor 1|IGF1','Tuesday'),('Insulin','Wednesday; fasting 8–12 hours'),('C-Peptide','Wednesday; fasting 8–12 hours'),('Follicle Stimulating Hormone|FSH','Wednesday'),('Luteinizing Hormone|LH','Wednesday'),('Aldosterone','Friday'),('Renin','Friday; fasting 8–12 hours'),('Estradiol','Friday'),('Adrenocorticotropic Hormone|ACTH','Friday; fasting 8–12 hours')]
for name,day in nuclear:
    add(name,'Nuclear Medicine','Nuclear Medicine','Blood','purple' if name in ['Renin','Adrenocorticotropic Hormone|ACTH'] else 'red',13,f'Source schedule: {day}. Availability varies; call 3152 and confirm volume.',needsReview=True)

add('''Antithrombin III|AT III
Factor VIII Inhibitor
Factor XI''','MRL','Hematology','Blood','blue',15,'Fasting 4–6 hours; blue top 4–5 mL.')
add("Ham's Test\nLAP|Leukocyte alkaline phosphatase",'MRL','Hematology','Blood','unknown',15,'Specimen/container requirement incomplete; confirm.',needsReview=True)
add('Iron Stain\nMPO\nPAS','MRL','Hematology','Bone marrow','unknown',15,'Bone marrow specimen; confirm container.',needsReview=True)
add('''ANA IF
ANA CD
Anti DsDNA|dsDNA
Anti-Smith|SM
Anti U1RNP
Anti Ro/SSA
Anti La/SSB
Anti SCL70
Anti Jo1|Anti 101
P-ANCA|MPO antibody
C-ANCA|PR3 antibody
Anti CCP
Anti-Beta2 Glycoprotein
Beta 2 IgG
Beta 2 IgM
Lupus Panel
Anticardiolipin Antibody|ACA
ACA IgG
ACA IgM
C3
Serum Immunoglobulins|Serum Igs
IgG
IgM
IgA
LAT''','MRL','Immunology','Blood','red',15,'Red top, 3 mL; fasting 4–6 hours.')
add('ASST','MRL','Immunology','','unknown',15,'Source: c/o allergy fellow; exception to fasting. Confirm specimen requirements.',needsReview=True,dedicated=True)
add('APAS Panel','MRL','Immunology','Blood','special',15,'Two alternative tube sets in source. Select a set after confirmation.',dedicated=True,options=[dict(name='2 red + 4 blue (2.7 mL)',parts=[dict(container='red',count=2,instruction='Two red tops'),dict(container='blue',count=4,instruction='Four 2.7 mL blue tops')]),dict(name='5 blue (1.8 mL) — confirm interpretation',parts=[dict(container='blue',count=5,instruction='Source alternate wording: five 1.8 mL blue tops; confirm whether red tops are also needed.')])],needsReview=True)
add('''Lupus Anticoagulant
SCT
SCT with mixing
DRVVT|DRWVT
DRVVT with mixing|DRWVT with mixing
APTT
APTT with mixing''','MRL','Immunology','Blood','blue',15,'Blue top, filled to black line; source Immunology fasting 4–6 hours.')
add('Urine Wright Stain','MRL','Clinical Microscopy','Urine','unknown',15,'Confirm collection container.',needsReview=True)
add('Crystal Identification','MRL','Clinical Microscopy','Other body fluid','unknown',15,'Specify fluid and confirm container.',needsReview=True)
add('Urine Micral Test\nUrine Metanephrine','MRL',CHEM,'Urine','unknown',15,'Micral: morning urine. Confirm collection container and other requirements.',needsReview=True)
add('APOA\nAPOB\nLp(a)','MRL',CHEM,'','unknown',15,'Confirm specimen, container and volume.',needsReview=True)
add('''Modified Kinyoun Stain
Toluidine Blue O Stain
Giemsa Stain for Tzanck Smear
AFB Smear
Fungal Culture
TB Package|TB PCR culture AFB
HSV PCR''','MRL',MICRO,'','unknown',15,'Confirm specimen, site/source and container. TB package includes TB PCR, TB culture and AFB smear.',needsReview=True)
add('CALAS, serum|Serum CALAS\nMicroagglutination Test for Lepto|Lepto MAT|MAT','MRL',MICRO,'Blood','red',[15,23],'Red top; confirm volume and specimen source.',needsReview=True)
add('SLIDEX','MRL',MICRO,'CSF','unknown',15,'CSF specimen; confirm container.',needsReview=True)
add('TB Culture and Sensitivity, bone marrow|BMA TB culture','MRL',MICRO,'Bone marrow','green',15,'Bone marrow specimen, green top.',dedicated=True)
add('Lepto Culture, blood|Blood lepto culture','MRL',MICRO,'Blood','green',[15,23],'Specifically sodium heparin green top.',dedicated=True)
add('TB PCR, bone marrow|BMA TB PCR','MRL',MICRO,'Bone marrow','purple',15,'Bone marrow specimen, purple top.')
add('Serum Free Light Chain|FLC','MRL','Immunology','Blood','red',29,'Red top; fasting 4–6 hours.')
add('ICC ELISA|HIV ELISA','SAGIP','SAGIP','Blood','red',17,'5 mL red top. Submit labeled to SAGIP, then Central Lab Immunopathology. Source: Mon–Fri 8 AM–3 PM; Immunopath ELISA cutoff 11 AM.',dedicated=True)
add('CD4 / Viral Load / Resistance set|CD4 viral load resistance','SAGIP','SAGIP','Blood','special',17,'Source groups CD4, viral load and resistance with alternative purple-top sets. Confirm set and ordered tests.',dedicated=True,needsReview=True,options=[dict(name='8 purple tops × 2 mL',parts=[dict(container='purple',count=8,instruction='Eight 2 mL purple tops')]),dict(name='2 purple tops × 4 mL',parts=[dict(container='purple',count=2,instruction='Two 4 mL purple tops')])])
for name in ['CD4 count','Viral Load','Resistance Test']:
    add(name,'SAGIP','SAGIP','Blood','unknown',17,'Source lists these jointly with tube-set alternatives (8×2 mL or 2×4 mL purple). Confirm individual test requirements; Tue/Wed/Thu 8–10 AM.',needsReview=True,dedicated=True)

add('''Hepatitis C Virus Real-time PCR Quantitative|HCV RNA|HCV PCR
Hepatitis C Virus Genotyping
HIV Drug Resistance / Genotyping
HIV RNA Real-time PCR Quantitative
CD4 Count
HSV/VZV PCR Qualitative
JCV-RNA
Japanese Encephalitis Qualitative
Dengue PCR Qualitative
Chikungunya PCR Qualitative
Zika Virus PCR Qualitative
GeneXpert MTB/Rif|GeneXpert
Clostridium Difficile Ag/Tox A/B Assay''','NIH','Send-out','','unknown',18,'Confirm current specimen, container, availability and submission requirements with NIH.',needsReview=True)
add('Hepatitis B Virus DNA|HBV DNA','NIH','Send-out','Blood','purple',[18,21],'Source: 4 mL purple, Mon–Fri 8 AM–noon; ₱5,600; later entry says monthly running. Historical details; confirm current requirements.',needsReview=True)
add('''Leptospirosis MAT and Culture
Direct Fecal Smear
Kato Thick
Kato Katz
Formalin Ether Concentration
Circumoval Precipitin Test|COPT
Malaria Smear
Filaria Smear
Malaria Parasite Count
IFAT for Amoeba
Knott Concentration Technique
Perianal Cellulose Tape Swab''','CPH','Send-out','','unknown',18,'Confirm specimen and container with CPH. Kato Katz source: thumb-sized stool, accomplished request, Mon–Fri 9 AM–1 PM, ₱150. Historical details.',needsReview=True)
add('HBV DNA','Hi-Precision','Send-out','Blood','purple',21,'Source: two 4 mL purple tops, transport on ice, submission 6 AM–2 PM; historical price ₱4,800. Confirm current requirements.',dedicated=True,needsReview=True,options=[dict(name='2 purple × 4 mL',parts=[dict(container='purple',count=2,instruction='Two 4 mL purple tops; transport on ice')])])
add('HCV RNA|HCV PCR','Hi-Precision','Send-out','Blood','purple',21,'Source: two 4 mL purple tops, transport on ice, submission 6 AM–2 PM; historical price ₱6,800. Confirm current requirements.',dedicated=True,needsReview=True,options=[dict(name='2 purple × 4 mL',parts=[dict(container='purple',count=2,instruction='Two 4 mL purple tops; transport on ice')])])
add('Vitamin D|Vit D\niPTH|IPTH ECLIA|IPTH IRMA','Hi-Precision','Send-out','Blood','red',31,'Source 29 Oct 2025: red top 1–3 cc. Vitamin D ₱2,100; iPTH ₱1,700 with 10–12 hours fasting. Confirm current requirements.',needsReview=True)

for specimen, message in [('CSF',27),('Pleural fluid',20),('Pericardial fluid',20),('Ascitic fluid',20)]:
    if specimen!='CSF':
        add(f'{specimen} quantitative|{specimen} quanti\n{specimen} LDH\n{specimen} Albumin',CENTRAL,CHEM,specimen,'cup',message,'Compatible Chemistry tests share one cup. Spell out specimen name; do not abbreviate PF.')
        add('\n'.join(f'{specimen} {n}' for n in ['qualitative','Direct Wet Mount','RBC Morphology','pH','Specific Gravity']),CENTRAL,MICROSCOPY,specimen,'cup',message,'Compatible Microscopy tests share one cup. Qualitative includes cell count and differential.')
    add('\n'.join(f'{specimen} {n}' for n in ['AFB','TB Culture','Anaerobic Culture','Gram Stain/Culture','Fungal Culture','India Ink','KOH Mount']),CENTRAL,MICRO,specimen,'cup',message,'Compatible Microbiology tests share one cup. Specify site/source.')
    add(f'{specimen} Cytology','Surgical Pathology','Cytology',specimen,'cup',message,'Source: fix with 95% ethanol at 1:1 ratio; submit with Surgical Pathology request. Confirm handling with laboratory.',dedicated=True)
    add('\n'.join(f'{specimen} {n}' for n in ['TB PCR','MTB/Rif','TB GeneXpert']+(['HSV PCR'] if specimen=='CSF' else [])),'MRL',MICRO,specimen,'cup',message,'One MRL cup in source. CSF TB testing: Mon/Fri and TB-DOTS referral in source. Confirm current instructions.')
    add(f'{specimen} Adenosine Deaminase|{specimen} ADA',"St. Luke’s QC",'Send-out',specimen,'unknown',message,'Source: ≥10 mL, not viscous, indicate L/R and collection date/time, transport on ice; daily running, no cutoff, 4–6h results, ₱2,939. Historical details; confirm container/current requirements.',needsReview=True)

add('Routine biopsy\nFrozen section\nAdequacy\nCytology\nFNAB, inpatient\nSlide Review\nGiemsa for H. pylori\nPeriodic Acid Schiff\nReticular Fibers Stain','Surgical Pathology','Surgical Pathology','','unknown',[], 'Specify specimen/organ and confirm container/handling with Surgical Pathology. Use the built-in consultation form.',needsReview=True,dedicated=True)
Path('src/data/catalog.json').write_text(json.dumps(tests,ensure_ascii=False,indent=2)+'\n')
print(f'{len(tests)} source-linked catalog entries')
