// config/email.js
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

// Transporter reutilizable usando Gmail + App Password
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // tu correo Gmail
    pass: process.env.EMAIL_PASS  // contraseña de aplicación (16 caracteres)
  }
});

// Función genérica para enviar correos
async function sendEmail({ to, subject, html }) {
  const mailOptions = {
    from: `"Fenalco Santander" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html
  };

  await transporter.sendMail(mailOptions);
}

// Ejemplos específicos que puedes usar desde el backend

async function sendStatusChangeEmail(to, request, newStatusLabel) {
  const html = `
    <h2>Actualización de estado de requerimiento</h2>
    <p><strong>ID:</strong> ${request.requestNumber}</p>
    <p><strong>Título:</strong> ${request.title}</p>
    <p><strong>Nuevo estado:</strong> ${newStatusLabel}</p>
    <p>Ingresa a la plataforma para ver más detalles.</p>
  `;

  await sendEmail({
    to,
    subject: `Actualización de estado - ${request.requestNumber}`,
    html
  });
}

async function sendNewRequestEmail(to, request) {
  const html = `
    <h2>Nueva solicitud de diseño</h2>
    <p><strong>ID:</strong> ${request.requestNumber}</p>
    <p><strong>Título:</strong> ${request.title}</p>
    <p><strong>Área:</strong> ${request.area}</p>
    <p><strong>Urgencia:</strong> ${request.urgency}</p>
    <p>Ingresa a la plataforma para asignarla o revisarla.</p>
  `;

  await sendEmail({
    to,
    subject: `Nueva solicitud de diseño - ${request.requestNumber}`,
    html
  });
}

module.exports = {
  transporter,
  sendEmail,
  sendStatusChangeEmail,
  sendNewRequestEmail
};
