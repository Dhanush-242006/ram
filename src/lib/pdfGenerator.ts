import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TravelPlan } from '../types';

export const generatePDF = (plan: TravelPlan) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(22);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text('Your Bespoke Travel Itinerary', pageWidth / 2, 20, { align: 'center' });
  
  doc.setFontSize(14);
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text(`${plan.origin} to ${plan.destination}`, pageWidth / 2, 30, { align: 'center' });
  doc.text(`${plan.itinerary.length} Day Journey`, pageWidth / 2, 38, { align: 'center' });

  // Transport Section
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59);
  doc.text('Transport Options', 14, 55);
  
  const transportData = plan.transportOptions.map(t => [
    `${t.type}: ${t.company}`,
    `${t.departureLocation} → ${t.arrivalLocation}`,
    t.timings,
    t.duration
  ]);

  autoTable(doc, {
    startY: 60,
    head: [['Option', 'Route', 'Timing', 'Duration']],
    body: transportData,
    theme: 'striped',
    headStyles: { fillColor: [79, 70, 229] } // accent color
  });

  // Itinerary Section
  let currentY = (doc as any).lastAutoTable.finalY + 15;
  
  doc.setFontSize(16);
  doc.text('Day-by-Day Itinerary', 14, currentY);
  currentY += 10;

  plan.itinerary.forEach((day, index) => {
    if (currentY > 250) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFontSize(14);
    doc.setTextColor(79, 70, 229);
    doc.text(`Day ${day.day} - ${day.date}`, 14, currentY);
    currentY += 8;

    const t = day.intercityTransport;
    const isRealTransport = t && t.type && typeof t.type === 'string' && t.type.trim().length > 0 && t.type.toLowerCase() !== 'string' &&
      t.departureLocation && typeof t.departureLocation === 'string' && t.departureLocation.trim().length > 0 && t.departureLocation.toLowerCase() !== 'string' &&
      t.arrivalLocation && typeof t.arrivalLocation === 'string' && t.arrivalLocation.trim().length > 0 && t.arrivalLocation.toLowerCase() !== 'string';

    if (isRealTransport) {
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(`Transition: ${day.intercityTransport.type} (${day.intercityTransport.company}) from ${day.intercityTransport.departureLocation} to ${day.intercityTransport.arrivalLocation}`, 14, currentY);
      currentY += 6;
      doc.text(`Duration: ${day.intercityTransport.duration}, Timings: ${day.intercityTransport.timings}`, 14, currentY);
      currentY += 8;
    }

    const dayActivities = day.activities.map(a => [
      a.time,
      a.plan.split('.')[0], // Short title
      a.transport.type,
      a.reminder
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Time', 'Plan', 'Transport', 'Tips']],
      body: dayActivities,
      theme: 'plain',
      headStyles: { textColor: [100, 116, 139], fontStyle: 'bold' },
      styles: { cellPadding: 3, fontSize: 9 },
      margin: { left: 14, right: 14 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 12;
  });

  // Hotels Section
  if (currentY > 230) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59);
  doc.text('Recommended Stays', 14, currentY);
  currentY += 10;

  const hotelData = plan.hotels.map(h => [
    `${h.name}\n${h.description || ''}`,
    h.category,
    h.pricePerNight,
    `${h.phoneNumber || ''}\n${h.website || ''}`
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Hotel Details', 'Category', 'Price/Night', 'Contact']],
    body: hotelData,
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229] },
    styles: { fontSize: 8, cellPadding: 4 }
  });

  // Packing Guide Section
  currentY = (doc as any).lastAutoTable.finalY + 15;
  if (plan.packingGuide && plan.packingGuide.length > 0) {
    if (currentY > 230) {
      doc.addPage();
      currentY = 20;
    }
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.text('What to Pack', 14, currentY);
    currentY += 10;

    const packingData = plan.packingGuide.map(p => [
      p.category,
      p.items.join(', ')
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Category', 'Essential Items']],
      body: packingData,
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] },
      styles: { fontSize: 9, cellPadding: 4 }
    });
    currentY = (doc as any).lastAutoTable.finalY + 15;
  }

  // Summary Section
  if (currentY > 250) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFontSize(16);
  doc.text('Cost Summary (All Inclusive)', 14, currentY);
  currentY += 10;

  const summaryData = [
    ['Accommodations', plan.dailyCostBreakdown.stay],
    ['Dining', plan.dailyCostBreakdown.food],
    ['Local Travel', plan.dailyCostBreakdown.travel],
    ['Activities', plan.dailyCostBreakdown.activities],
    ['Total Estimated Cost (INR)', plan.totalCostSummary.inr]
  ];

  autoTable(doc, {
    startY: currentY,
    body: summaryData,
    theme: 'plain',
    styles: { fontStyle: 'bold', fontSize: 10 }
  });

  // Footer note
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('Calculated by NCPL AI Trip Planner. All prices are estimates.', 14, doc.internal.pageSize.getHeight() - 10);

  doc.save(`Itinerary_${plan.destination}.pdf`);
};
