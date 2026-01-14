import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from 'pdf-lib';
import type { EicrReportWithDetails, DistributionBoard, EicrCircuit, EicrObservation } from '@shared/schema';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);

interface DrawContext {
  page: PDFPage;
  y: number;
  font: PDFFont;
  boldFont: PDFFont;
}

async function addNewPage(pdfDoc: PDFDocument, font: PDFFont, boldFont: PDFFont): Promise<DrawContext> {
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  return { page, y: PAGE_HEIGHT - MARGIN, font, boldFont };
}

function drawText(ctx: DrawContext, text: string, x: number, options?: { size?: number; color?: any; bold?: boolean }) {
  const size = options?.size || 10;
  const font = options?.bold ? ctx.boldFont : ctx.font;
  ctx.page.drawText(text, { x, y: ctx.y, size, font, color: options?.color || rgb(0, 0, 0) });
}

function drawLine(ctx: DrawContext, x1: number, y1: number, x2: number, y2: number, thickness = 0.5) {
  ctx.page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color: rgb(0, 0, 0) });
}

function drawCell(ctx: DrawContext, text: string, x: number, width: number, height: number, options?: { bold?: boolean; size?: number; align?: 'left' | 'center' | 'right'; bgColor?: any }) {
  const size = options?.size || 8;
  const font = options?.bold ? ctx.boldFont : ctx.font;
  
  if (options?.bgColor) {
    ctx.page.drawRectangle({
      x,
      y: ctx.y - height + 2,
      width,
      height,
      color: options.bgColor,
    });
  }
  
  ctx.page.drawRectangle({
    x,
    y: ctx.y - height + 2,
    width,
    height,
    borderColor: rgb(0, 0, 0),
    borderWidth: 0.5,
  });
  
  const textWidth = font.widthOfTextAtSize(text, size);
  let textX = x + 3;
  if (options?.align === 'center') {
    textX = x + (width - textWidth) / 2;
  } else if (options?.align === 'right') {
    textX = x + width - textWidth - 3;
  }
  
  ctx.page.drawText(text, {
    x: textX,
    y: ctx.y - height + 5 + (height / 3),
    size,
    font,
    color: rgb(0, 0, 0),
  });
}

export async function generateEicrPdf(report: EicrReportWithDetails): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  let ctx = await addNewPage(pdfDoc, font, boldFont);
  
  drawText(ctx, 'ELECTRICAL INSTALLATION CONDITION REPORT', MARGIN, { size: 14, bold: true });
  ctx.y -= 20;
  drawText(ctx, `(to ${report.standard || 'BS 7671:2018+A2:2022'})`, MARGIN, { size: 10 });
  ctx.y -= 25;
  
  drawText(ctx, 'SECTION A: DETAILS OF THE CLIENT', MARGIN, { size: 11, bold: true });
  ctx.y -= 18;
  
  const labelWidth = 150;
  const valueWidth = CONTENT_WIDTH - labelWidth;
  
  const clientDetails = [
    ['Client Name:', report.clientName],
    ['Client Address:', report.clientAddress || ''],
    ['Installation Address:', report.installationAddress],
    ['Installation Postcode:', report.installationPostcode || ''],
    ['Occupier Name:', report.occupierName || ''],
    ['Occupier Phone:', report.occupierPhone || ''],
  ];
  
  for (const [label, value] of clientDetails) {
    drawCell(ctx, label, MARGIN, labelWidth, 18, { bold: true, bgColor: rgb(0.95, 0.95, 0.95) });
    drawCell(ctx, value, MARGIN + labelWidth, valueWidth, 18);
    ctx.y -= 18;
  }
  
  ctx.y -= 20;
  drawText(ctx, 'SECTION B: SUPPLY CHARACTERISTICS AND EARTHING ARRANGEMENTS', MARGIN, { size: 11, bold: true });
  ctx.y -= 18;
  
  const supplyDetails = [
    ['Maximum Demand:', report.maxDemand || 'N/A'],
    ['Supply Type:', report.supplyType || 'TN-C-S'],
    ['Ze Value (Ω):', report.zeValue?.toString() || 'N/A'],
  ];
  
  for (const [label, value] of supplyDetails) {
    drawCell(ctx, label, MARGIN, labelWidth, 18, { bold: true, bgColor: rgb(0.95, 0.95, 0.95) });
    drawCell(ctx, value, MARGIN + labelWidth, valueWidth, 18);
    ctx.y -= 18;
  }
  
  ctx.y -= 20;
  drawText(ctx, 'SECTION C: OUTCOME OF INSPECTION', MARGIN, { size: 11, bold: true });
  ctx.y -= 20;
  
  const outcome = report.outcome || 'PENDING';
  const outcomeColor = outcome === 'SATISFACTORY' ? rgb(0, 0.5, 0) : outcome === 'UNSATISFACTORY' ? rgb(0.7, 0, 0) : rgb(0.3, 0.3, 0.3);
  
  ctx.page.drawRectangle({
    x: MARGIN,
    y: ctx.y - 25,
    width: CONTENT_WIDTH,
    height: 30,
    borderColor: outcomeColor,
    borderWidth: 2,
  });
  
  const outcomeText = `Overall Condition: ${outcome}`;
  const outcomeWidth = boldFont.widthOfTextAtSize(outcomeText, 14);
  ctx.page.drawText(outcomeText, {
    x: MARGIN + (CONTENT_WIDTH - outcomeWidth) / 2,
    y: ctx.y - 15,
    size: 14,
    font: boldFont,
    color: outcomeColor,
  });
  ctx.y -= 40;
  
  for (const board of report.boards) {
    if (ctx.y < 200) {
      ctx = await addNewPage(pdfDoc, font, boldFont);
    }
    
    ctx.y -= 10;
    drawText(ctx, `DISTRIBUTION BOARD: ${board.dbRef} - ${board.location}`, MARGIN, { size: 11, bold: true });
    ctx.y -= 18;
    
    if (board.designation) {
      drawText(ctx, `Designation: ${board.designation}`, MARGIN, { size: 9 });
      ctx.y -= 14;
    }
    
    const boardInfo = [];
    if (board.mainSwitchRating) boardInfo.push(`Main Switch: ${board.mainSwitchRating}A`);
    if (board.rcdProtected) boardInfo.push(`RCD: ${board.rcdType || 'Yes'} ${board.rcdRating ? board.rcdRating + 'mA' : ''}`);
    if (board.earthingArrangement) boardInfo.push(`Earthing: ${board.earthingArrangement}`);
    
    if (boardInfo.length > 0) {
      drawText(ctx, boardInfo.join(' | '), MARGIN, { size: 8 });
      ctx.y -= 16;
    }
    
    if (board.circuits.length > 0) {
      const headers = ['Cct', 'Description', 'Type', 'A', 'Curve', 'RCD', 'r1+r2', 'Zs', 'IR', 'Pol'];
      const colWidths = [30, 120, 40, 25, 35, 45, 45, 45, 55, 30];
      
      let x = MARGIN;
      for (let i = 0; i < headers.length; i++) {
        drawCell(ctx, headers[i], x, colWidths[i], 16, { bold: true, size: 7, align: 'center', bgColor: rgb(0.85, 0.85, 0.85) });
        x += colWidths[i];
      }
      ctx.y -= 16;
      
      for (const circuit of board.circuits) {
        if (ctx.y < 60) {
          ctx = await addNewPage(pdfDoc, font, boldFont);
          ctx.y -= 10;
          x = MARGIN;
          for (let i = 0; i < headers.length; i++) {
            drawCell(ctx, headers[i], x, colWidths[i], 16, { bold: true, size: 7, align: 'center', bgColor: rgb(0.85, 0.85, 0.85) });
            x += colWidths[i];
          }
          ctx.y -= 16;
        }
        
        x = MARGIN;
        const values = [
          circuit.circuitRef,
          circuit.description.substring(0, 20),
          circuit.breakerType,
          circuit.breakerRating?.toString() || '',
          circuit.curve || '',
          circuit.rcdProtected ? `${circuit.rcdIdeltaMa || 30}mA` : 'N/A',
          circuit.r1PlusR2?.toFixed(2) || '',
          circuit.zs?.toFixed(2) || '',
          circuit.irLn ? `${circuit.irLn.toFixed(0)}MΩ` : '',
          circuit.polarityOk ? '✓' : '✗',
        ];
        
        for (let i = 0; i < values.length; i++) {
          drawCell(ctx, values[i], x, colWidths[i], 14, { size: 7, align: i === 1 ? 'left' : 'center' });
          x += colWidths[i];
        }
        ctx.y -= 14;
      }
    }
    ctx.y -= 10;
  }
  
  if (report.observations.length > 0) {
    if (ctx.y < 150) {
      ctx = await addNewPage(pdfDoc, font, boldFont);
    }
    
    ctx.y -= 10;
    drawText(ctx, 'SECTION D: OBSERVATIONS', MARGIN, { size: 11, bold: true });
    ctx.y -= 20;
    
    const obsHeaders = ['Code', 'Location', 'Circuit', 'Description'];
    const obsWidths = [40, 100, 60, CONTENT_WIDTH - 200];
    
    let x = MARGIN;
    for (let i = 0; i < obsHeaders.length; i++) {
      drawCell(ctx, obsHeaders[i], x, obsWidths[i], 16, { bold: true, size: 8, bgColor: rgb(0.85, 0.85, 0.85) });
      x += obsWidths[i];
    }
    ctx.y -= 16;
    
    for (const obs of report.observations) {
      if (ctx.y < 60) {
        ctx = await addNewPage(pdfDoc, font, boldFont);
        x = MARGIN;
        for (let i = 0; i < obsHeaders.length; i++) {
          drawCell(ctx, obsHeaders[i], x, obsWidths[i], 16, { bold: true, size: 8, bgColor: rgb(0.85, 0.85, 0.85) });
          x += obsWidths[i];
        }
        ctx.y -= 16;
      }
      
      const codeColor = obs.code === 'C1' ? rgb(0.8, 0, 0) : 
                        obs.code === 'C2' ? rgb(0.8, 0.4, 0) :
                        obs.code === 'C3' ? rgb(0.6, 0.6, 0) : rgb(0, 0, 0);
      
      x = MARGIN;
      drawCell(ctx, obs.code, x, obsWidths[0], 16, { size: 8, align: 'center', bold: true });
      x += obsWidths[0];
      drawCell(ctx, obs.location || '', x, obsWidths[1], 16, { size: 8 });
      x += obsWidths[1];
      drawCell(ctx, obs.circuitRef || '', x, obsWidths[2], 16, { size: 8, align: 'center' });
      x += obsWidths[2];
      drawCell(ctx, obs.description.substring(0, 60), x, obsWidths[3], 16, { size: 7 });
      ctx.y -= 16;
    }
  }
  
  if (ctx.y < 150) {
    ctx = await addNewPage(pdfDoc, font, boldFont);
  }
  
  ctx.y -= 30;
  drawText(ctx, 'SECTION E: DECLARATION', MARGIN, { size: 11, bold: true });
  ctx.y -= 20;
  
  const declarationDetails = [
    ['Inspector Name:', report.inspectorName || ''],
    ['Registration No:', report.inspectorRegistration || ''],
    ['Inspection Date:', report.inspectionDate ? new Date(report.inspectionDate).toLocaleDateString('en-GB') : ''],
    ['Next Inspection Due:', report.nextInspectionDate ? new Date(report.nextInspectionDate).toLocaleDateString('en-GB') : ''],
  ];
  
  for (const [label, value] of declarationDetails) {
    drawCell(ctx, label, MARGIN, labelWidth, 18, { bold: true, bgColor: rgb(0.95, 0.95, 0.95) });
    drawCell(ctx, value, MARGIN + labelWidth, 200, 18);
    ctx.y -= 18;
  }
  
  ctx.y -= 20;
  drawText(ctx, 'Signature:', MARGIN, { size: 10, bold: true });
  
  if (report.inspectorSignature && report.inspectorSignature.startsWith('data:image')) {
    try {
      const base64Data = report.inspectorSignature.split(',')[1];
      const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      const signatureImage = await pdfDoc.embedPng(imageBytes);
      const sigDims = signatureImage.scale(0.3);
      ctx.page.drawImage(signatureImage, {
        x: MARGIN + 60,
        y: ctx.y - 40,
        width: Math.min(sigDims.width, 150),
        height: Math.min(sigDims.height, 40),
      });
    } catch (e) {
      drawText(ctx, '[Signature on file]', MARGIN + 60, { size: 9 });
    }
  }
  
  const pages = pdfDoc.getPages();
  for (let i = 0; i < pages.length; i++) {
    pages[i].drawText(`Report: ${report.reference}`, {
      x: MARGIN,
      y: 20,
      size: 8,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
    pages[i].drawText(`Page ${i + 1} of ${pages.length}`, {
      x: PAGE_WIDTH - MARGIN - 50,
      y: 20,
      size: 8,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
  }
  
  return pdfDoc.save();
}
