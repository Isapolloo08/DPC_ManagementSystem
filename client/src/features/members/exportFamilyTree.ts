import type { FamilyPerson, FamilyRelationship } from '../../types';
import { familyTreeLayout, familyTreeCardSize } from './familyTreeLayout';

// Vector export includes every person in the current scope, independent of scroll and zoom.
export async function exportFamilyTree(name: string, people: FamilyPerson[], edges: FamilyRelationship[], printWindow: Window | null = null) {
  const { jsPDF } = await import('jspdf');
  const layout = familyTreeLayout(people, edges);
  const pdf = new jsPDF({orientation:'landscape',unit:'pt',format:'a3'});
  const pageWidth=pdf.internal.pageSize.getWidth(), pageHeight=pdf.internal.pageSize.getHeight();
  const scale=Math.min((pageWidth-64)/layout.width,(pageHeight-130)/layout.height,1);
  const offsetX=(pageWidth-layout.width*scale)/2,offsetY=78;
  const x=(n:number)=>offsetX+n*scale,y=(n:number)=>offsetY+n*scale;
  pdf.setFont('helvetica','bold');pdf.setFontSize(20);pdf.setTextColor(44,57,104);
  pdf.text('Family Tree Lineage',32,35);
  pdf.setFont('helvetica','normal');pdf.setFontSize(11);pdf.setTextColor(102,112,133);
  pdf.text(`${name} | ${people.length} people in this view`,32,55);
  const {width,height}=familyTreeCardSize;
  pdf.setDrawColor(117,145,205);pdf.setLineWidth(1);
  for(const edge of edges) {
    const a=layout.positions.get(edge.from_person_id),b=layout.positions.get(edge.to_person_id);
    if(!a||!b)continue;
    const x1=a.x+width/2,x2=b.x+width/2,y1=a.y+height,y2=b.y+(edge.kind==='spouse'?height:0);
    const mid=edge.kind==='spouse'?y1+40:(y1+y2)/2;
    pdf.setLineDashPattern(edge.kind==='guardian'?[4,3]:[],0);
    pdf.line(x(x1),y(y1),x(x1),y(mid));pdf.line(x(x1),y(mid),x(x2),y(mid));pdf.line(x(x2),y(mid),x(x2),y(y2));
  }
  pdf.setLineDashPattern([],0);
  for(const person of people) {
    const pos=layout.positions.get(person.id)!;
    pdf.setFillColor(255,255,255);pdf.setDrawColor(199,211,234);
    pdf.roundedRect(x(pos.x),y(pos.y),width*scale,height*scale,10*scale,10*scale,'FD');
    pdf.setFont('helvetica','normal');pdf.setFontSize(10*scale);pdf.setTextColor(82,105,155);
    const household=pdf.splitTextToSize(person.household_name || 'Household not recorded',(width-32)*scale);
    pdf.text(household.slice(0,2),x(pos.x+16),y(pos.y+25));
    pdf.setFont('helvetica','bold');pdf.setFontSize(14*scale);pdf.setTextColor(16,24,40);
    const lines=pdf.splitTextToSize(person.name,(width-32)*scale);
    pdf.text(lines.slice(0,3),x(pos.x+16),y(pos.y+64));
    pdf.setFont('helvetica','normal');pdf.setFontSize(10*scale);pdf.setTextColor(102,112,133);
    pdf.text(person.member_id?'Registered member':'Unregistered relative',x(pos.x+16),y(pos.y+height-18));
  }
  pdf.setFontSize(9);pdf.text('Solid lines: parent / spouse connections. Dashed lines: guardian connections.',32,pageHeight-25);
  if(printWindow) {
    pdf.autoPrint();
    const url=URL.createObjectURL(pdf.output('blob'));
    printWindow.location.href=url;
    // Keep the URL available long enough for the browser's PDF viewer to read it.
    window.setTimeout(()=>URL.revokeObjectURL(url),300000);
  }
  else pdf.save(`${name.replace(/[^a-z0-9 _-]/gi,'').trim() || 'Household'}-family-tree.pdf`);
}
