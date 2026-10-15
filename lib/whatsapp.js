// Builds a https://wa.me/... link. If a plausible phone number is given,
// the chat opens already pointed at that contact; otherwise it opens
// WhatsApp with the message ready and lets the teacher pick who to send
// it to. No WhatsApp Business API or paid account needed either way —
// this is just a URL scheme WhatsApp itself provides.
function buildWhatsAppLink(phoneMaybe, message) {
  let digits = (phoneMaybe || '').replace(/[^\d]/g, '');
  // wa.me needs the country code. Most numbers here are saved as plain
  // 10-digit Indian mobiles (or with a leading 0), so add 91 for those.
  if (digits.length === 11 && digits[0] === '0') digits = digits.slice(1);
  if (digits.length === 10 && /^[6-9]/.test(digits)) digits = `91${digits}`;
  const text = encodeURIComponent(message);
  if (digits.length >= 8) {
    return `https://wa.me/${digits}?text=${text}`;
  }
  return `https://api.whatsapp.com/send?text=${text}`;
}

module.exports = { buildWhatsAppLink };
