// Builds a https://wa.me/... link. If a plausible phone number is given,
// the chat opens already pointed at that contact; otherwise it opens
// WhatsApp with the message ready and lets the teacher pick who to send
// it to. No WhatsApp Business API or paid account needed either way —
// this is just a URL scheme WhatsApp itself provides.
function buildWhatsAppLink(phoneMaybe, message) {
  const digits = (phoneMaybe || '').replace(/[^\d]/g, '');
  const text = encodeURIComponent(message);
  if (digits.length >= 8) {
    return `https://wa.me/${digits}?text=${text}`;
  }
  return `https://api.whatsapp.com/send?text=${text}`;
}

module.exports = { buildWhatsAppLink };
