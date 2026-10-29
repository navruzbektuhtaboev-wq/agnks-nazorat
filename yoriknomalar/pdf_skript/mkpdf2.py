import json, re
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_JUSTIFY, TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, PageBreak, Table, TableStyle, Flowable, KeepTogether

FD="/usr/share/fonts/truetype/liberation/"
pdfmetrics.registerFont(TTFont("S",FD+"LiberationSerif-Regular.ttf"))
pdfmetrics.registerFont(TTFont("S-B",FD+"LiberationSerif-Bold.ttf"))
pdfmetrics.registerFont(TTFont("S-I",FD+"LiberationSerif-Italic.ttf"))
pdfmetrics.registerFont(TTFont("S-BI",FD+"LiberationSerif-BoldItalic.ttf"))
pdfmetrics.registerFontFamily("S",normal="S",bold="S-B",italic="S-I",boldItalic="S-BI")

import os
HERE=os.path.dirname(os.path.abspath(__file__))
D=os.path.join(HERE,"..","matnlar","")
order=["d-fire","d-emerg","d-leak","d-ppe","d-aid","d-oper","d-fill","d-vessel","d-elec","d-hot","d-guard"]

base=ParagraphStyle("b",fontName="S",fontSize=11,leading=14.2,alignment=TA_JUSTIFY,spaceAfter=3)
sub=ParagraphStyle("sub",parent=base,leftIndent=11*mm,firstLineIndent=-11*mm)
bul=ParagraphStyle("bul",parent=base,leftIndent=11*mm,firstLineIndent=-4.5*mm)
head=ParagraphStyle("h",parent=base,fontName="S-B",fontSize=12,leading=16,spaceBefore=9,spaceAfter=4,alignment=TA_LEFT,keepWithNext=1)
title=ParagraphStyle("t",parent=base,fontName="S-B",fontSize=15,leading=19,alignment=TA_CENTER,spaceBefore=4,spaceAfter=4)
kicker=ParagraphStyle("k",parent=base,fontName="S",fontSize=11,alignment=TA_CENTER,spaceAfter=2)
appr=ParagraphStyle("a",parent=base,fontName="S",fontSize=10.5,leading=14,alignment=TA_LEFT)
small=ParagraphStyle("s",parent=base,fontSize=10,leading=13,alignment=TA_LEFT)
cell=ParagraphStyle("c",parent=base,fontSize=10.5,leading=13,alignment=TA_LEFT,spaceAfter=0)
cellh=ParagraphStyle("ch",parent=cell,fontName="S-B",alignment=TA_CENTER)


ORG="«ПОЙТУГ 888» МЧЖ"
STATION="АГНКС-1"
from reportlab.graphics.shapes import *
RED=colors.HexColor("#D32F2F"); YEL=colors.HexColor("#FFC107"); GRN=colors.HexColor("#2E7D32")
def flame(c,x,y,sz,col):
    p=c.beginPath(); k=sz
    p.moveTo(x,y-k*.5); p.curveTo(x-k*.55,y-k*.2,x-k*.35,y+k*.25,x-k*.05,y+k*.5)
    p.curveTo(x+0,y+k*.25,x+k*.15,y+k*.15,x+k*.2,y+k*.0); p.curveTo(x+k*.5,y+k*.25,x+k*.55,y-k*.25,x,y-k*.5)
    p.close(); c.setFillColor(col); c.drawPath(p,fill=1,stroke=0)
def sign(c,kind,x,y,s):
    c.saveState(); cx,cy=x+s/2,y+s/2
    if kind in("nosmoke","noflame"):
        c.setLineWidth(s*.09); c.setStrokeColor(RED); c.setFillColor(colors.white); c.circle(cx,cy,s*.45,fill=1,stroke=1)
        if kind=="nosmoke":
            c.setFillColor(colors.black); c.rect(cx-s*.30,cy-s*.05,s*.46,s*.09,fill=1,stroke=0)
            c.setFillColor(colors.HexColor("#E65100")); c.rect(cx+s*.16,cy-s*.05,s*.10,s*.09,fill=1,stroke=0)
            c.setStrokeColor(colors.black); c.setLineWidth(s*.025); c.line(cx+s*.2,cy+s*.08,cx+s*.2,cy+s*.2)
        else: flame(c,cx,cy,s*.55,colors.black)
        c.setStrokeColor(RED); c.setLineWidth(s*.09); c.line(cx-s*.32,cy+s*.32,cx+s*.32,cy-s*.32)
    elif kind=="gas":
        p=c.beginPath(); p.moveTo(cx,y+s*.97); p.lineTo(x+s*.02,y+s*.07); p.lineTo(x+s*.98,y+s*.07); p.close()
        c.setFillColor(YEL); c.setStrokeColor(colors.black); c.setLineWidth(s*.05); c.drawPath(p,fill=1,stroke=1)
        flame(c,cx,y+s*.40,s*.40,colors.black)
    elif kind=="ext":
        c.setFillColor(RED); c.roundRect(x+s*.03,y+s*.03,s*.94,s*.94,s*.08,fill=1,stroke=0)
        c.setFillColor(colors.white); c.roundRect(cx-s*.14,y+s*.15,s*.28,s*.45,s*.08,fill=1,stroke=0)
        c.rect(cx-s*.05,y+s*.58,s*.10,s*.12,fill=1,stroke=0); c.rect(cx-s*.14,y+s*.68,s*.30,s*.06,fill=1,stroke=0)
        c.setStrokeColor(colors.white); c.setLineWidth(s*.04); c.line(cx+s*.16,y+s*.72,cx+s*.30,y+s*.55)
    elif kind=="exit":
        c.setFillColor(GRN); c.roundRect(x+s*.03,y+s*.03,s*.94,s*.94,s*.08,fill=1,stroke=0)
        c.setFillColor(colors.white); c.rect(x+s*.2,y+s*.2,s*.2,s*.6,fill=1,stroke=0)
        c.setStrokeColor(colors.white); c.setLineWidth(s*.07); c.line(x+s*.5,cy,x+s*.82,cy)
        p=c.beginPath(); p.moveTo(x+s*.9,cy); p.lineTo(x+s*.72,cy+s*.14); p.lineTo(x+s*.72,cy-s*.14); p.close(); c.setFillColor(colors.white); c.drawPath(p,fill=1,stroke=0)
    c.restoreState()
def logo(c,x,y,s):
    c.saveState(); c.setFillColor(colors.HexColor("#0B4F8A")); c.roundRect(x,y,s,s,s*.18,fill=1,stroke=0)
    flame(c,x+s*.5,y+s*.58,s*.55,colors.HexColor("#FFB300"))
    c.setFillColor(colors.white); c.setFont("S-B",s*.26); c.drawCentredString(x+s*.5,y+s*.1,"888"); c.restoreState()
class Banner(Flowable):
    def __init__(s,sub): super().__init__(); s.sub=sub
    def wrap(s,w,h): s.w=w; return (w,19*mm)
    def draw(s):
        c=s.canv; logo(c,0,2*mm,15*mm)
        c.setFillColor(colors.HexColor("#0B4F8A")); c.setFont("S-B",14); c.drawString(18*mm,10*mm,ORG)
        c.setFillColor(colors.HexColor("#444444")); c.setFont("S",9.5); c.drawString(18*mm,5*mm,"Автомобилларга газ қуйиш компрессор станцияси "+STATION)
        x=s.w-5*13*mm
        for k in ["nosmoke","noflame","gas","ext","exit"]:
            sign(c,k,x,2*mm,12*mm); x+=13*mm
        c.setStrokeColor(colors.HexColor("#0B4F8A")); c.setLineWidth(1.2); c.line(0,0.5*mm,s.w,0.5*mm)

def esc(t): return t.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")

class SetDoc(Flowable):
    def __init__(s,name,short): super().__init__(); s.name=name; s.short=short
    def wrap(s,w,h): return (0,0)
    def draw(s):
        G["title"]=s.short; G["offset"]=s.canv.getPageNumber()-1
G={"title":"","offset":0}

def footer(c,doc):
    c.saveState()
    w,h=A4
    c.setStrokeColor(colors.HexColor("#888888")); c.setLineWidth(.4)
    c.line(25*mm,15*mm,w-15*mm,15*mm)
    c.setFont("S",8.5); c.setFillColor(colors.HexColor("#444444"))
    c.drawString(25*mm,10.5*mm,"АГНКС · "+G["title"])
    c.drawRightString(w-15*mm,10.5*mm,"Бет "+str(c.getPageNumber()-G["offset"]))
    c.setFont("S-I",8); c.setFillColor(colors.HexColor("#9a3b00"))
    c.drawCentredString(w/2,6.5*mm,"ЛОЙИҲА: тасдиқлашдан олдин амалдаги меъёрий ҳужжатлар ва АГНКС паспорти билан текширилсин")
    c.restoreState()

def parse(body):
    body=body.split("\n\n",1)[1] if body.startswith("ЛОЙИҲА") else body
    body=body.split("\n\nЭЛЕКТРОН ТАСДИҚ")[0]
    out=[]
    for ln in body.split("\n"):
        ln=ln.rstrip()
        if not ln: continue
        if re.match(r"^\d+\.\s+[А-ЯЁЎҚҒҲ]{3,}",ln): out.append(Paragraph(esc(ln),head))
        elif re.match(r"^\d+\.\d+\.",ln):
            n,t=ln.split(" ",1); out.append(Paragraph("<b>"+esc(n)+"</b>  "+esc(t),sub))
        elif ln.startswith("Асос:"): out.append(Paragraph("<i>"+esc(ln)+"</i>",small))
        elif ln.startswith("- "): out.append(Paragraph("—  "+esc(ln[2:]),bul))
        else: out.append(Paragraph(esc(ln),base))
    return out

def sigblock():
    t=Table([
      [Paragraph("Йўриқномани ишлаб чиқди:",appr),Paragraph("________________ / ______________________",appr)],
      [Paragraph("Меҳнат муҳофазаси ва ёнғин хавфсизлиги бўйича масъул:",appr),Paragraph("________________ / ______________________",appr)],
      [Paragraph("Келишилди (касаба уюшмаси / ходимлар вакили):",appr),Paragraph("________________ / ______________________",appr)],
    ],colWidths=[85*mm,85*mm])
    t.setStyle(TableStyle([("VALIGN",(0,0),(-1,-1),"BOTTOM"),("TOPPADDING",(0,0),(-1,-1),9)]))
    return t

def ack_sheet(d):
    rows=[[Paragraph("№",cellh),Paragraph("Ф.И.Ш.",cellh),Paragraph("Лавозими",cellh),Paragraph("Танишган сана",cellh),Paragraph("Имзо",cellh)]]
    for i in range(1,19): rows.append([Paragraph(str(i),cellh),"","","",""])
    t=Table(rows,colWidths=[10*mm,62*mm,38*mm,30*mm,30*mm],rowHeights=[10*mm]+[9.2*mm]*18)
    t.setStyle(TableStyle([("GRID",(0,0),(-1,-1),.6,colors.black),("BACKGROUND",(0,0),(-1,0),colors.HexColor("#EDEDED")),("VALIGN",(0,0),(-1,-1),"MIDDLE")]))
    ps=", ".join(d["positions"]) if d["positions"] else "барча лавозимлар"
    return [Paragraph("ЙЎРИҚНОМА БИЛАН ТАНИШИШ ВАРАҒИ",title),
            Paragraph("«"+esc(d["title"])+"»",kicker),
            Paragraph("Йўриқнома рақами: № ____ · Версия: "+str(d["version"])+" · Кимлар учун: "+esc(ps),kicker),
            Spacer(1,5*mm),
            Paragraph("Мен қуйида имзо чекувчилар юқоридаги йўриқнома матни билан танишдим, мазмуни тушунарли, талабларни бажаришга мажбуриман.",small),
            Spacer(1,4*mm), t]

def build(path,keys):
    global PAGES; PAGES={}
    doc=BaseDocTemplate(path,pagesize=A4,leftMargin=25*mm,rightMargin=15*mm,topMargin=16*mm,bottomMargin=20*mm,
        title="АГНКС йўриқномалари (лойиҳа)",author="АГНКС")
    fr=Frame(doc.leftMargin,doc.bottomMargin,doc.width,doc.height,id="f",leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)
    doc.addPageTemplates([PageTemplate(id="p",frames=[fr],onPageEnd=footer)])
    story=[]
    for n,k in enumerate(keys):
        d=json.load(open(D+k+".json",encoding="utf-8"))
        if n: story.append(PageBreak())
        story.append(SetDoc(d["title"],d["title"][:70]))
        ap=Table([[Paragraph("",appr),Paragraph("<b>ТАСДИҚЛАЙМАН</b><br/>АГНКС бошлиғи<br/>________________ ____________________<br/><font size=8.5>(имзо)&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;(Ф.И.Ш.)</font><br/>«____» ______________ 20___ й.",appr)]],colWidths=[85*mm,85*mm])
        ap.setStyle(TableStyle([("VALIGN",(0,0),(-1,-1),"TOP"),("LEFTPADDING",(0,0),(-1,-1),0)]))
        story+=[Banner(""),Spacer(1,3*mm),ap,Spacer(1,4*mm),
                Paragraph("ЙЎРИҚНОМА № ____",kicker),
                Paragraph(esc(d["title"]).upper(),title),
                Paragraph("Йўналиш: "+esc(d["category"])+" · Версия "+str(d["version"])+" · Сана: "+".".join(reversed(d["issued"].split("-"))),kicker),
                Spacer(1,3*mm)]
        story+=parse(d["body"])
        story+=[Spacer(1,4*mm),KeepTogether([sigblock()]),PageBreak(),Banner("")]+ack_sheet(d)
    doc.build(story)

build(os.path.join(HERE,"..","agnks-yoriknomalar-loyiha-v3.pdf"),order)
print("ok")
