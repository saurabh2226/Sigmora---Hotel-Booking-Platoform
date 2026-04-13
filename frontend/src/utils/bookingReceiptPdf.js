const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const PAGE_MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - (PAGE_MARGIN * 2);

const COLORS = {
  brand: [0.059, 0.463, 0.431],
  brandSoft: [0.921, 0.973, 0.965],
  ink: [0.09, 0.129, 0.157],
  muted: [0.365, 0.427, 0.455],
  border: [0.855, 0.894, 0.91],
  surface: [0.985, 0.992, 0.996],
  successSoft: [0.925, 0.98, 0.949],
  success: [0.063, 0.725, 0.506],
  warnSoft: [0.996, 0.957, 0.871],
  warn: [0.851, 0.482, 0.024],
  dangerSoft: [0.996, 0.922, 0.922],
  danger: [0.878, 0.239, 0.239],
  white: [1, 1, 1],
};

const byteLength = (value) => new TextEncoder().encode(value).length;

const sanitizeText = (value = '') => String(value ?? '')
  .replace(/[^\x20-\x7E]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const escapePdfText = (value = '') => sanitizeText(value)
  .replace(/\\/g, '\\\\')
  .replace(/\(/g, '\\(')
  .replace(/\)/g, '\\)');

const toColorString = (color) => color.map((component) => Number(component).toFixed(3)).join(' ');

const formatMoney = (amount = 0) => {
  const value = Number(amount || 0);
  return `INR ${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(value))}`;
};

const formatShortDate = (date) => {
  if (!date) return 'Not available';
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatLongDate = (date) => {
  if (!date) return 'Not available';
  return new Date(date).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

const toStatusLabel = (status) => {
  const normalized = String(status || 'pending').replace(/-/g, ' ');
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const getStatusTone = (status) => {
  if (status === 'confirmed') {
    return {
      fill: COLORS.successSoft,
      text: COLORS.success,
      label: 'Confirmed',
    };
  }

  if (status === 'pending') {
    return {
      fill: COLORS.warnSoft,
      text: COLORS.warn,
      label: 'Pending Payment',
    };
  }

  return {
    fill: COLORS.dangerSoft,
    text: COLORS.danger,
    label: toStatusLabel(status),
  };
};

const estimateTextWidth = (text, fontSize) => sanitizeText(text).length * fontSize * 0.49;

const wrapText = (text, maxWidth, fontSize) => {
  const cleaned = sanitizeText(text);
  if (!cleaned) return [''];

  const words = cleaned.split(' ');
  const lines = [];
  let currentLine = '';

  words.forEach((word) => {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (estimateTextWidth(candidate, fontSize) <= maxWidth) {
      currentLine = candidate;
      return;
    }

    if (currentLine) {
      lines.push(currentLine);
      currentLine = word;
      return;
    }

    let fragment = '';
    word.split('').forEach((char) => {
      const nextFragment = fragment + char;
      if (estimateTextWidth(nextFragment, fontSize) <= maxWidth) {
        fragment = nextFragment;
      } else {
        lines.push(fragment);
        fragment = char;
      }
    });
    currentLine = fragment;
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
};

const createPdfDocument = () => {
  const pages = [[]];
  let cursorY = PAGE_MARGIN;

  const currentPage = () => pages[pages.length - 1];
  const toPdfY = (topY) => PAGE_HEIGHT - topY;

  const addCommand = (command) => {
    currentPage().push(command);
  };

  const addPage = () => {
    pages.push([]);
    cursorY = PAGE_MARGIN;
  };

  const ensureSpace = (height) => {
    if (cursorY + height > PAGE_HEIGHT - PAGE_MARGIN) {
      addPage();
    }
  };

  const drawRect = (x, y, width, height, { fill, stroke, lineWidth = 1 } = {}) => {
    const operators = [];
    operators.push('q');
    if (fill) operators.push(`${toColorString(fill)} rg`);
    if (stroke) operators.push(`${toColorString(stroke)} RG`);
    if (stroke) operators.push(`${lineWidth} w`);
    operators.push(`${x.toFixed(2)} ${(PAGE_HEIGHT - y - height).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re`);
    operators.push(fill && stroke ? 'B' : fill ? 'f' : 'S');
    operators.push('Q');
    addCommand(operators.join('\n'));
  };

  const drawLine = (x1, y1, x2, y2, { color = COLORS.border, lineWidth = 1 } = {}) => {
    addCommand([
      'q',
      `${toColorString(color)} RG`,
      `${lineWidth} w`,
      `${x1.toFixed(2)} ${toPdfY(y1).toFixed(2)} m`,
      `${x2.toFixed(2)} ${toPdfY(y2).toFixed(2)} l`,
      'S',
      'Q',
    ].join('\n'));
  };

  const drawText = (text, { x, y, size = 12, font = 'F1', color = COLORS.ink } = {}) => {
    addCommand([
      'BT',
      `/${font} ${size} Tf`,
      `${toColorString(color)} rg`,
      `1 0 0 1 ${x.toFixed(2)} ${(PAGE_HEIGHT - y).toFixed(2)} Tm`,
      `(${escapePdfText(text)}) Tj`,
      'ET',
    ].join('\n'));
  };

  const drawParagraph = (text, { x, y, width, size = 12, font = 'F1', color = COLORS.ink, lineGap } = {}) => {
    const lines = wrapText(text, width, size);
    const leading = lineGap || Math.max(size + 4, 14);

    lines.forEach((line, index) => {
      drawText(line, {
        x,
        y: y + (index * leading),
        size,
        font,
        color,
      });
    });

    return {
      lines,
      height: lines.length * leading,
      leading,
    };
  };

  const buildPdf = () => {
    let nextId = 1;
    const catalogId = nextId++;
    const pagesId = nextId++;
    const regularFontId = nextId++;
    const boldFontId = nextId++;

    const pageDefinitions = pages.map((commands) => ({
      pageId: nextId++,
      contentId: nextId++,
      stream: commands.join('\n'),
    }));

    const objects = new Map();
    objects.set(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
    objects.set(pagesId, `<< /Type /Pages /Kids [${pageDefinitions.map((page) => `${page.pageId} 0 R`).join(' ')}] /Count ${pageDefinitions.length} >>`);
    objects.set(regularFontId, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    objects.set(boldFontId, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

    pageDefinitions.forEach((page) => {
      objects.set(
        page.pageId,
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${page.contentId} 0 R >>`
      );
      objects.set(
        page.contentId,
        `<< /Length ${byteLength(page.stream)} >>\nstream\n${page.stream}\nendstream`
      );
    });

    let pdf = '%PDF-1.4\n';
    const offsets = [0];

    for (let objectId = 1; objectId < nextId; objectId += 1) {
      offsets[objectId] = byteLength(pdf);
      pdf += `${objectId} 0 obj\n${objects.get(objectId)}\nendobj\n`;
    }

    const xrefOffset = byteLength(pdf);
    pdf += `xref\n0 ${nextId}\n`;
    pdf += '0000000000 65535 f \n';

    for (let objectId = 1; objectId < nextId; objectId += 1) {
      pdf += `${String(offsets[objectId]).padStart(10, '0')} 00000 n \n`;
    }

    pdf += `trailer\n<< /Size ${nextId} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return new Blob([pdf], { type: 'application/pdf' });
  };

  return {
    get cursorY() {
      return cursorY;
    },
    set cursorY(value) {
      cursorY = value;
    },
    addPage,
    ensureSpace,
    drawRect,
    drawLine,
    drawText,
    drawParagraph,
    buildPdf,
  };
};

const drawSectionCard = (doc, { title, rows, note, accentColor = COLORS.brand } = {}) => {
  const safeRows = rows
    .filter((row) => row && sanitizeText(row.value))
    .map((row) => {
      const labelLines = wrapText(row.label, CONTENT_WIDTH - 56, 9);
      const valueLines = wrapText(row.value, CONTENT_WIDTH - 56, 12);
      const labelHeight = labelLines.length * 12;
      const valueHeight = valueLines.length * 16;
      return {
        label: row.label,
        value: row.value,
        labelLines,
        valueLines,
        height: 18 + labelHeight + valueHeight,
      };
    });

  const titleLines = wrapText(title, CONTENT_WIDTH - 56, 16);
  const titleHeight = titleLines.length * 20;
  const noteLines = note ? wrapText(note, CONTENT_WIDTH - 76, 11) : [];
  const noteHeight = noteLines.length ? 22 + (noteLines.length * 14) + 14 : 0;
  const rowsHeight = safeRows.reduce((sum, row) => sum + row.height, 0);
  const cardHeight = 30 + titleHeight + 12 + rowsHeight + noteHeight + 16;

  doc.ensureSpace(cardHeight + 16);

  const top = doc.cursorY;
  doc.drawRect(PAGE_MARGIN, top, CONTENT_WIDTH, cardHeight, {
    fill: COLORS.surface,
    stroke: COLORS.border,
  });
  doc.drawRect(PAGE_MARGIN, top, 7, cardHeight, { fill: accentColor });

  let y = top + 30;
  titleLines.forEach((line) => {
    doc.drawText(line, {
      x: PAGE_MARGIN + 24,
      y,
      size: 16,
      font: 'F2',
      color: COLORS.ink,
    });
    y += 20;
  });

  y += 4;
  safeRows.forEach((row, index) => {
    if (index > 0) {
      doc.drawLine(PAGE_MARGIN + 24, y - 8, PAGE_MARGIN + CONTENT_WIDTH - 24, y - 8);
    }

    row.labelLines.forEach((line, labelIndex) => {
      doc.drawText(line, {
        x: PAGE_MARGIN + 24,
        y: y + (labelIndex * 12),
        size: 9,
        font: 'F2',
        color: COLORS.muted,
      });
    });

    const valueStartY = y + (row.labelLines.length * 12) + 4;
    row.valueLines.forEach((line, valueIndex) => {
      doc.drawText(line, {
        x: PAGE_MARGIN + 24,
        y: valueStartY + (valueIndex * 16),
        size: 12,
        font: 'F1',
        color: COLORS.ink,
      });
    });

    y += row.height;
  });

  if (noteLines.length) {
    const noteTop = y + 4;
    const noteHeightBox = 18 + (noteLines.length * 14) + 12;
    doc.drawRect(PAGE_MARGIN + 24, noteTop, CONTENT_WIDTH - 48, noteHeightBox, {
      fill: COLORS.brandSoft,
      stroke: COLORS.border,
    });
    noteLines.forEach((line, index) => {
      doc.drawText(line, {
        x: PAGE_MARGIN + 38,
        y: noteTop + 20 + (index * 14),
        size: 11,
        font: 'F1',
        color: COLORS.muted,
      });
    });
  }

  doc.cursorY = top + cardHeight + 16;
};

const buildReceiptPayload = (booking) => {
  const adults = booking?.guests?.adults || 1;
  const children = booking?.guests?.children || 0;
  const totalGuests = adults + children;
  const numberOfNights = booking?.pricing?.numberOfNights
    || Math.max(0, Math.round((new Date(booking?.checkOut) - new Date(booking?.checkIn)) / (1000 * 60 * 60 * 24)));

  return {
    bookingId: booking?._id ? booking._id.slice(-8).toUpperCase() : 'SIGMORA',
    status: String(booking?.status || 'pending').toLowerCase(),
    hotelTitle: sanitizeText(booking?.hotel?.title || 'Sigmora Hotel'),
    location: sanitizeText([booking?.hotel?.address?.city, booking?.hotel?.address?.state].filter(Boolean).join(', ') || 'Location available inside the app'),
    roomTitle: sanitizeText(booking?.room?.title || 'Selected room'),
    roomType: sanitizeText(booking?.room?.type || 'Room'),
    guestName: sanitizeText(booking?.guestDetails?.name || booking?.user?.name || 'Guest'),
    guestEmail: sanitizeText(booking?.guestDetails?.email || booking?.user?.email || 'Not provided'),
    guestPhone: sanitizeText(booking?.guestDetails?.phone || booking?.user?.phone || 'Not provided'),
    specialRequests: sanitizeText(booking?.guestDetails?.specialRequests || 'No special requests were added during booking.'),
    createdAt: formatLongDate(booking?.createdAt || new Date()),
    checkIn: formatLongDate(booking?.checkIn),
    checkOut: formatLongDate(booking?.checkOut),
    numberOfNights,
    totalGuests,
    occupancy: `${adults} adult${adults !== 1 ? 's' : ''}${children ? `, ${children} child${children !== 1 ? 'ren' : ''}` : ''}`,
    paymentStatus: toStatusLabel(booking?.payment?.status || 'pending'),
    paymentMethod: sanitizeText(booking?.payment?.method || 'Razorpay'),
    transactionId: sanitizeText(booking?.payment?.transactionId || 'Will appear after payment confirmation'),
    couponCode: sanitizeText(booking?.pricing?.couponCode || ''),
    baseNightlyRate: formatMoney(booking?.pricing?.baseNightlyRate || booking?.pricing?.nightlyRate || booking?.room?.pricePerNight || 0),
    chargedNightlyRate: formatMoney(booking?.pricing?.nightlyRate || booking?.room?.pricePerNight || 0),
    subtotal: formatMoney(booking?.pricing?.subtotal || 0),
    taxes: formatMoney(booking?.pricing?.taxes || 0),
    serviceFee: formatMoney(booking?.pricing?.serviceFee || 0),
    discount: Number(booking?.pricing?.discount || 0) > 0 ? `- ${formatMoney(booking?.pricing?.discount || 0)}` : '',
    refundAmount: Number(booking?.refundAmount || 0) > 0 ? formatMoney(booking?.refundAmount || 0) : '',
    total: formatMoney(booking?.pricing?.totalPrice || 0),
    stayLine: `${formatShortDate(booking?.checkIn)} to ${formatShortDate(booking?.checkOut)} (${numberOfNights} night${numberOfNights !== 1 ? 's' : ''})`,
  };
};

export const downloadBookingReceiptPdf = (booking) => {
  if (!booking) {
    throw new Error('Booking details are not available for receipt download');
  }

  const payload = buildReceiptPayload(booking);
  const statusTone = getStatusTone(payload.status);
  const doc = createPdfDocument();

  const bannerTop = doc.cursorY;
  const bannerHeight = 144;
  doc.ensureSpace(bannerHeight + 20);
  doc.drawRect(PAGE_MARGIN, bannerTop, CONTENT_WIDTH, bannerHeight, {
    fill: COLORS.brandSoft,
    stroke: COLORS.border,
  });
  doc.drawRect(PAGE_MARGIN, bannerTop, 10, bannerHeight, { fill: COLORS.brand });
  doc.drawText('Sigmora', {
    x: PAGE_MARGIN + 26,
    y: bannerTop + 28,
    size: 13,
    font: 'F2',
    color: COLORS.brand,
  });
  doc.drawText('Booking Receipt', {
    x: PAGE_MARGIN + 26,
    y: bannerTop + 58,
    size: 25,
    font: 'F2',
    color: COLORS.ink,
  });
  doc.drawParagraph(
    `${payload.hotelTitle} | ${payload.roomTitle} | Generated on ${payload.createdAt}`,
    {
      x: PAGE_MARGIN + 26,
      y: bannerTop + 86,
      width: 300,
      size: 11,
      color: COLORS.muted,
    }
  );

  doc.drawRect(PAGE_MARGIN + CONTENT_WIDTH - 156, bannerTop + 26, 126, 26, {
    fill: statusTone.fill,
  });
  doc.drawText(statusTone.label, {
    x: PAGE_MARGIN + CONTENT_WIDTH - 140,
    y: bannerTop + 43,
    size: 11,
    font: 'F2',
    color: statusTone.text,
  });

  doc.drawRect(PAGE_MARGIN + CONTENT_WIDTH - 190, bannerTop + 68, 160, 52, {
    fill: COLORS.white,
    stroke: COLORS.border,
  });
  doc.drawText('Total Amount', {
    x: PAGE_MARGIN + CONTENT_WIDTH - 174,
    y: bannerTop + 89,
    size: 10,
    font: 'F2',
    color: COLORS.muted,
  });
  doc.drawText(payload.total, {
    x: PAGE_MARGIN + CONTENT_WIDTH - 174,
    y: bannerTop + 112,
    size: 18,
    font: 'F2',
    color: COLORS.brand,
  });

  doc.cursorY = bannerTop + bannerHeight + 18;

  drawSectionCard(doc, {
    title: 'Property and stay details',
    rows: [
      { label: 'Booking ID', value: payload.bookingId },
      { label: 'Hotel', value: payload.hotelTitle },
      { label: 'Location', value: payload.location },
      { label: 'Room selected', value: `${payload.roomTitle} (${payload.roomType})` },
      { label: 'Stay dates', value: payload.stayLine },
      { label: 'Guests', value: `${payload.totalGuests} guests | ${payload.occupancy}` },
    ],
  });

  drawSectionCard(doc, {
    title: 'Guest profile',
    rows: [
      { label: 'Primary guest', value: payload.guestName },
      { label: 'Email', value: payload.guestEmail },
      { label: 'Phone', value: payload.guestPhone },
    ],
    note: payload.specialRequests,
    accentColor: COLORS.warn,
  });

  drawSectionCard(doc, {
    title: 'Payment summary',
    rows: [
      { label: 'Payment status', value: payload.paymentStatus },
      { label: 'Payment method', value: payload.paymentMethod },
      { label: 'Transaction reference', value: payload.transactionId },
      { label: 'Base nightly rate', value: payload.baseNightlyRate },
      { label: 'Charged nightly rate', value: payload.chargedNightlyRate },
      { label: 'Subtotal', value: payload.subtotal },
      { label: 'Taxes', value: payload.taxes },
      { label: 'Service fee', value: payload.serviceFee },
      { label: 'Coupon code', value: payload.couponCode || 'No coupon applied' },
      { label: 'Discount', value: payload.discount || 'No discount applied' },
      { label: 'Refund amount', value: payload.refundAmount || 'No refund recorded' },
      { label: 'Total paid or payable', value: payload.total },
    ],
    note: payload.status === 'confirmed'
      ? 'This receipt confirms your stay details and payment summary for the current booking.'
      : 'If payment is still pending, your room will remain held only until the active hold window expires.',
    accentColor: COLORS.success,
  });

  drawSectionCard(doc, {
    title: 'Need help?',
    rows: [
      { label: 'Support', value: 'Reach the hotel or Sigmora support from the app dashboard for any booking help.' },
      { label: 'Cancellation and refunds', value: 'Refund processing depends on the booking status and the cancellation policy visible in your dashboard.' },
    ],
    note: 'Thank you for booking with Sigmora. We hope you have a smooth and comfortable stay.',
  });

  doc.ensureSpace(40);
  doc.drawText('Generated by Sigmora', {
    x: PAGE_MARGIN,
    y: doc.cursorY + 10,
    size: 9,
    font: 'F2',
    color: COLORS.muted,
  });
  doc.drawText(new Date().toLocaleString('en-IN'), {
    x: PAGE_MARGIN + 110,
    y: doc.cursorY + 10,
    size: 9,
    font: 'F1',
    color: COLORS.muted,
  });

  const blob = doc.buildPdf();
  const bookingCode = payload.bookingId || 'SIGMORA';
  const fileName = `sigmora-booking-receipt-${bookingCode}.pdf`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 2000);
};
