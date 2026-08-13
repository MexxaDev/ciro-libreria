'use strict';

import { format } from './currency.js';
import { getPaymentMethodLabel, PAYMENT_METHODS } from './payments.js';
import { BRAND } from '../config/brandConfig.js';

const MOVEMENT_LABELS = {
  opening: 'Apertura',
  in: 'Ingreso Manual',
  out: 'Egreso Manual',
  sale: 'Venta',
  payment: 'Cobro de deuda'
};

export async function exportCashToPDF(summary, movements, settings) {
  const { jsPDF } = window.jspdf;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const businessName = settings?.businessName || BRAND.name;
  const businessAddress = settings?.address || BRAND.address;

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  const session = summary.session || {
    id: summary.sessionId,
    openedAt: summary.openedAt,
    closedAt: summary.closedAt,
    userName: summary.userName,
    observation: summary.observation
  };

  let y = margin;

  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(businessName, pageWidth / 2, y, { align: 'center' });
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(businessAddress, pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.text('Reporte de Caja', pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.text(new Date().toLocaleString('es-AR'), pageWidth / 2, y, { align: 'center' });
  y += 12;

  doc.setDrawColor(200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(60);
  doc.text('INFORMACIÓN DE LA SESIÓN', margin, y);
  y += 7;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80);

  const sessionLines = [
    `Sesión: ${session.id}`,
    `Apertura: ${new Date(session.openedAt).toLocaleString('es-AR')}`,
    `Responsable: ${session.userName || 'N/A'}`
  ];
  if (session.closedAt) {
    sessionLines.push(`Cierre: ${new Date(session.closedAt).toLocaleString('es-AR')}`);
  }
  if (session.observation) {
    sessionLines.push(`Observación: ${session.observation}`);
  }

  sessionLines.forEach(line => {
    doc.text(line, margin, y);
    y += 5;
  });
  y += 4;

  doc.setDrawColor(200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(60);
  doc.text('RESUMEN ECONÓMICO', margin, y);
  y += 7;

  const summaryRows = [['Monto Inicial', format(summary.initialAmount)]];

  const methodsData = summary.methods || null;
  if (methodsData) {
    for (const pm of PAYMENT_METHODS) {
      const d = methodsData[pm.id];
      if (!d) {
        continue;
      }
      const hasSales = d.sales !== 0;
      const hasManualIn = d.manualIn !== 0;
      const hasManualOut = d.manualOut !== 0;
      const hasDebt = (d.debtPayments || 0) !== 0;
      if (!hasSales && !hasManualIn && !hasManualOut && !hasDebt) {
        continue;
      }

      if (hasSales) {
        summaryRows.push([`Ventas ${pm.label}`, format(d.sales)]);
      }
      if (hasDebt) {
        summaryRows.push([`Cobro de deuda (${pm.label})`, `+ ${format(d.debtPayments)}`]);
      }
      if (hasManualIn) {
        summaryRows.push([`Ingreso Manual (${pm.label})`, `+ ${format(d.manualIn)}`]);
      }
      if (hasManualOut) {
        summaryRows.push([`Egreso Manual (${pm.label})`, `- ${format(d.manualOut)}`]);
      }
    }
  } else {
    summaryRows.push(
      ['Ingresos Manuales', `+ ${format(summary.manualIn)}`],
      ['Egresos Manuales', `- ${format(summary.manualOut)}`]
    );
    if (summary.debtPayments) {
      summaryRows.push(['Cobros de deuda', `+ ${format(summary.debtPayments)}`]);
    }
    summaryRows.push(
      ['Ventas Efectivo', format(summary.cashSales)],
      ['Ventas Transferencia', format(summary.transferSales)],
      ['Ventas Débito', format(summary.debitSales)],
      ['Ventas Cuenta Corriente', format(summary.accountSales)]
    );
  }

  summaryRows.push(['Total Ventas', format(summary.totalSales)], ['Efectivo Esperado', format(summary.expectedTotal)]);

  doc.autoTable({
    startY: y,
    head: [['Concepto', 'Monto']],
    body: summaryRows,
    theme: 'grid',
    headStyles: {
      fillColor: [124, 58, 237],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [60, 60, 60]
    },
    columnStyles: {
      0: { cellWidth: contentWidth * 0.6 },
      1: { cellWidth: contentWidth * 0.4, halign: 'right' }
    },
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    foot: summaryRows.length > 0 ? [['Efectivo Esperado', format(summary.expectedTotal)]] : undefined,
    footStyles: {
      fillColor: [237, 233, 254],
      textColor: [91, 33, 182],
      fontStyle: 'bold',
      fontSize: 10
    }
  });

  y = doc.lastAutoTable.finalY + 8;

  doc.setDrawColor(200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(60);
  doc.text('MOVIMIENTOS', margin, y);
  y += 7;

  if (!movements || movements.length === 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150);
    doc.text('No se registraron movimientos en esta sesión.', margin, y);
  } else {
    const sorted = [...movements].sort((a, b) => new Date(b.date) - new Date(a.date));

    const movRows = sorted.map(m => {
      const typeLabel = MOVEMENT_LABELS[m.type] || m.type;
      const pmLabel = m.paymentMethod ? getPaymentMethodLabel(m.paymentMethod) : '-';
      const sign = m.type === 'out' ? '- ' : '+ ';
      return [
        new Date(m.date).toLocaleString('es-AR'),
        typeLabel,
        m.description || '-',
        pmLabel,
        `${sign}${format(m.amount)}`
      ];
    });

    doc.autoTable({
      startY: y,
      head: [['Fecha', 'Tipo', 'Descripción', 'Método Pago', 'Monto']],
      body: movRows,
      theme: 'grid',
      headStyles: {
        fillColor: [124, 58, 237],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [60, 60, 60]
      },
      columnStyles: {
        0: { cellWidth: contentWidth * 0.22 },
        1: { cellWidth: contentWidth * 0.13 },
        2: { cellWidth: contentWidth * 0.3 },
        3: { cellWidth: contentWidth * 0.17 },
        4: { cellWidth: contentWidth * 0.18, halign: 'right' }
      },
      margin: { left: margin, right: margin },
      tableWidth: contentWidth,
      pageBreak: 'auto'
    });
  }

  y = doc.lastAutoTable ? doc.lastAutoTable.finalY + 15 : y + 15;

  if (y > doc.internal.pageSize.getHeight() - 30) {
    doc.addPage();
    y = margin;
  }

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150);
  doc.text(
    `Generado el ${new Date().toLocaleString('es-AR')} · ${businessName}`,
    pageWidth / 2,
    doc.internal.pageSize.getHeight() - 10,
    { align: 'center' }
  );

  const fileName = `caja-${session.id.replace(/[^a-zA-Z0-9]/g, '_')}-${new Date().toISOString().substring(0, 10)}.pdf`;
  doc.save(fileName);
}
