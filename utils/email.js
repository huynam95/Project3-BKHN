const nodemailer = require('nodemailer');
const pug = require('pug');
const htmlToText = require('html-to-text');

module.exports = class Email {
  constructor(user, url) {
    this.to = user.email;
    this.firstname = user.name.split(' ')[0];
    this.url = url;
    this.from = `<${process.env.EMAIL_FROM}>`;
  }

  newTransport() {
    if (process.env.NODE_ENV === 'production') {
      // Sendgrid
      // create user using 'mailsac' where the email will be sent instead of gmail
      return nodemailer.createTransport({
        service: 'Brevo',
        host: process.env.SENDINBLUE_HOST,
        port: process.env.SENDINBLUE_PORT,
        auth: {
          user: process.env.SENDINBLUE_LOGIN,
          pass: process.env.SENDINBLUE_PASSWORD,
        },
      });
    }
    // create a transporter
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASS,
      },

      // activation in gmail is less secure app option because of spam and request limitation
    });
  }

  // send the actual email
  async send(template, subject) {
    // render HTML based on a pug template
    const html = pug.renderFile(`${__dirname}/../views/email/${template}.pug`, {
      firstname: this.firstname,
      url: this.url,
      subject,
    });

    // define email options
    const mailOptions = {
      from:
        process.env.NODE_ENV === 'development'
          ? this.from
          : process.env.EMAIL_FROM,
      to: this.to,
      subject,
      html,
      text: htmlToText.convert(html),
    };

    // create a transport and send email
    await this.newTransport().sendMail(mailOptions);
  }

  async sendWelcome() {
    await this.send('welcome', 'welcome to natours.');
  }

  async sendPasswordReset() {
    await this.send(
      'passwordReset',
      'your password reset token (valid for 10 mins)'
    );
  }
};

// const sendEmail = async (options) => {
// // create a transporter
// const transporter = nodemailer.createTransport({
//   host: process.env.EMAIL_HOST,
//   port: process.env.EMAIL_PORT,
//   auth: {
//     user: process.env.EMAIL_USERNAME,
//     pass: process.env.EMAIL_PASSWORD,
//   },

//   // activation in gmail is less secure app option because of spam and request limitation
// });

// define the email options
// const mailOptions = {
//   from: 'ABK <abk@abk.io>',
//   to: options.email,
//   subject: options.subject,
//   text: options.message,
//   //html:
// };

// actually send the email
// await transporter.sendMail(mailOptions);
// };

// module.exports = sendEmail;
