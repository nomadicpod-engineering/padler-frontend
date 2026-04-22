/**
 * Client-side road ticket PDF (same layout as efex verify / public booking confirm).
 */
import { jsPDF } from 'jspdf';

export type BookingTicketPdfInput = {
  bookingReference: string;
  passengerName: string;
  tripId: number;
  /** One seat or "A1, B2" */
  seatNumber: string;
  status: string;
  priceLabel: string;
  dateLabel: string;
  companyName: string;
  companyLogoUrl?: string;
  /** Shown in the large route row; falls back to TRIP {id} */
  routeLine?: string;
};

const safe = (v: unknown) =>
  v === null || v === undefined || String(v).trim() === '' ? 'N/A' : String(v);

function escapeHtml(value: unknown) {
  return String(safe(value))
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function resolveImageDataUrl(url?: string) {
  if (!url || !url.trim()) return null;
  if (url.startsWith('data:image')) return url;
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Failed to read image as data URL'));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Renders the efex-style ticket and saves as a PDF in the browser.
 */
export async function downloadBookingTicketPdf(input: BookingTicketPdfInput): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

  const passengerName = escapeHtml(input.passengerName);
  const bookingReference = escapeHtml(input.bookingReference);
  const seatNumber = escapeHtml(input.seatNumber);
  const ticketStatus = escapeHtml(input.status);
  const tripId = escapeHtml(input.tripId);
  const price = escapeHtml(input.priceLabel);
  const travelDate = escapeHtml(input.dateLabel);
  const rawCompanyName = safe(input.companyName || 'Padler');
  const companyName = escapeHtml(rawCompanyName);
  const companyInitials = escapeHtml(
    rawCompanyName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? '')
      .join('') || 'P'
  );
  const routeDisplay = escapeHtml(input.routeLine?.trim() || `TRIP ${input.tripId}`);

  const companyLogoDataUrl = await resolveImageDataUrl(input.companyLogoUrl);
  const leftLogoMarkup = companyLogoDataUrl
    ? `<img class="company-logo" src="${companyLogoDataUrl}" alt="${companyName} logo" />`
    : `<div class="company-logo company-logo-fallback">${companyInitials}</div>`;
  const rightLogoMarkup = companyLogoDataUrl
    ? `<img class="side-logo" src="${companyLogoDataUrl}" alt="${companyName} logo" />`
    : `<div class="side-logo side-logo-fallback">${companyInitials}</div>`;

  const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Road Ticket</title>
      <style>
      * { box-sizing: border-box; }
      body {
          margin: 0;
          padding: 24px;
          background: #e5e5e5;
          height: auto;
          font-family: Arial, sans-serif;
      }
      .ticket {
          display: flex;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(0,0,0,0.15);
          width: 900px;
          margin: 0 auto;
      }
      .left {
          background: #f4f4f4;
          padding: 25px;
          width: 650px;
          position: relative;
      }
      .right {
          background: #ff4b4b;
          color: white;
          padding: 25px;
          width: 250px;
          text-align: center;
          position: relative;
      }
      .left::after {
          content: "";
          position: absolute;
          right: -10px;
          top: 0;
          height: 100%;
          width: 20px;
          background: radial-gradient(circle at center, #e5e5e5 6px, transparent 7px) repeat-y;
          background-size: 20px 25px;
      }
      .top-info { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 20px; gap: 8px; }
      .top-info span { display: block; font-weight: bold; font-size: 14px; margin-top: 5px; }
      .route {
          display: flex;
          justify-content: center;
          align-items: center;
          font-size: 26px;
          font-weight: bold;
          margin: 30px 0;
          text-align: center;
      }
      .route .bus { margin: 0 12px; }
      .details { display: flex; justify-content: space-between; margin-top: 20px; gap: 12px; }
      .details div { font-size: 14px; flex: 1; }
      .highlight { color: #ff4b4b; font-size: 28px; font-weight: bold; line-height: 1.1; }
      .footer { margin-top: 20px; font-size: 12px; text-align: center; }
      .barcode {
          width: 40px; min-width: 40px; height: 100%;
          background: repeating-linear-gradient(to bottom, black, black 3px, white 3px, white 6px);
          margin-right: 20px;
      }
      .left-content { display: flex; }
      .left-main { flex: 1; }
      .brand-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
      .brand-title { font-size: 18px; font-weight: 700; letter-spacing: 0.3px; }
      .company-logo { width: 52px; height: 52px; border-radius: 50%; object-fit: cover; border: 3px solid #ffffff; box-shadow: 0 2px 10px rgba(0,0,0,0.15); background: #fff; }
      .company-logo-fallback { display: inline-flex; align-items: center; justify-content: center; font-weight: 700; color: #ff4b4b; }
      .right h3 { margin: 0 0 10px; font-size: 14px; }
      .right p { font-size: 14px; margin: 8px 0; }
      .right .big { font-size: 20px; font-weight: bold; }
      .right .barcode-small {
          height: 50px; margin-top: 15px;
          background: repeating-linear-gradient(to right, white, white 3px, transparent 3px, transparent 6px);
      }
      .side-logo { width: 54px; height: 54px; border-radius: 50%; object-fit: cover; border: 2px solid rgba(255,255,255,0.7); margin: 0 auto 12px; background: rgba(255,255,255,0.9); }
      .side-logo-fallback { display: flex; align-items: center; justify-content: center; font-weight: 700; color: #ff4b4b; background: #fff; }
      </style>
      </head>
      <body>
      <div class="ticket">
          <div class="left">
              <div class="left-content">
                  <div class="barcode"></div>
                  <div class="left-main">
                      <div class="brand-row">
                          <div class="brand-title">${companyName}</div>
                          ${leftLogoMarkup}
                      </div>
                      <div class="top-info">
                          <div>Passenger Name <span>${passengerName}</span></div>
                          <div>Seat <span>${seatNumber}</span></div>
                          <div>Booking Ref <span>${bookingReference}</span></div>
                          <div>Date <span>${travelDate}</span></div>
                      </div>
                      <div class="route">
                          ROAD <span class="bus">🚌</span> <span>${routeDisplay}</span>
                      </div>
                      <div class="details">
                          <div>Status<br /><span class="highlight">${ticketStatus}</span></div>
                          <div>Price<br /><span class="highlight">${price}</span></div>
                      </div>
                      <div class="footer">PLEASE BE AT THE TERMINAL BEFORE DEPARTURE TIME</div>
                  </div>
              </div>
          </div>
          <div class="right">
              ${rightLogoMarkup}
              <h3>PASSENGER NAME</h3>
              <p class="big">${passengerName}</p>
              <p>COMPANY: <span class="big">${companyName}</span></p>
              <p>REF: <span class="big">${bookingReference}</span></p>
              <p>DATE: <span class="big">${travelDate}</span></p>
              <p>SEAT: ${seatNumber}</p>
              <p>TRIP ID: ${tripId}</p>
              <div class="barcode-small"></div>
          </div>
      </div>
      </body>
      </html>
    `;

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '900px';
  container.style.background = '#e5e5e5';
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    await new Promise<void>((resolve) => {
      doc.html(container, {
        x: 10,
        y: 14,
        width: 575,
        windowWidth: 900,
        html2canvas: {
          scale: 1.6,
          useCORS: true,
          backgroundColor: '#e5e5e5'
        },
        callback: () => resolve()
      });
    });
  } finally {
    document.body.removeChild(container);
  }

  const refForFile = safe(input.bookingReference).replace(/\s+/g, '-');
  doc.save(`ticket-${refForFile}.pdf`);
}
