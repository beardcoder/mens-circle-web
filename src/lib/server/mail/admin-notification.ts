/** The admin's note of a new registration. Generated from the former listmonk template; edit freely. */
import { escapeHtml as e } from '../../shared/html'

export interface AdminNotificationHtmlData {
  activeCount: string | number
  adminUrl: string | number
  dateShort: string | number
  eventTitle: string | number
  location: string | number
  maxParticipants: string | number
  participantEmail: string | number
  participantName: string | number
  participantPhone: string | number
  statusLabel: string | number
  subject: string | number
  timeRange: string | number
}

export const adminNotificationHtml = (d: AdminNotificationHtmlData): string => `<!doctype html>
<html lang="de" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light only">
  <title>${e(d.subject)}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <style>.em-serif { font-family: Georgia, serif !important; } .em-sans { font-family: Arial, sans-serif !important; }</style>
  <![endif]-->
  <!-- Webfonts from the site itself, never from a third party: no recipient IP leaves our server -->
  <!--[if !mso]><!-->
  <style>
    @font-face { font-family:'Cormorant'; font-style:normal; font-weight:500; font-display:swap; src:url(https://mens-circle.de/fonts/mail/cormorant-500.woff2) format('woff2'); }
    /* Dates and counts stand on the line */
    .em-serif, .em-event__date { font-feature-settings:'lnum'; font-variant-numeric:lining-nums; }
    @font-face { font-family:'Geist'; font-style:normal; font-weight:100 900; font-display:swap; src:url(https://mens-circle.de/fonts/mail/geist.woff2) format('woff2'); }
  </style>
  <!--<![endif]-->
  <style>
    body { margin:0 !important; padding:0 !important; width:100% !important; -webkit-text-size-adjust:100%; }
    table { border-collapse:collapse !important; }
    img { border:0; line-height:100%; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
    a { color:#141210; }
    a[x-apple-data-detectors] { color:inherit !important; text-decoration:none !important; font-size:inherit !important; font-family:inherit !important; font-weight:inherit !important; line-height:inherit !important; }
    .em-link { color:#141210 !important; text-decoration:underline; text-underline-offset:3px; }
    @media only screen and (max-width:620px) {
      .em-sheet { width:100% !important; }
      .em-pad { padding-left:24px !important; padding-right:24px !important; }
      .em-display { font-size:36px !important; }
      .em-date { font-size:23px !important; }
      .em-key { width:84px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f4f1ea;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#f4f1ea;opacity:0;">Neue Anmeldung: ${e(d.participantName)}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f1ea;">
  <!-- A dark band: its ground runs from edge to edge, its content stands on the 600px column -->
  <tr><td align="center" bgcolor="#141210" style="background-color:#141210;">
    <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
    <table role="presentation" class="em-sheet" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;"><tr><td class="em-pad" style="padding:22px 40px 44px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="padding-right:12px;vertical-align:middle;"><a href="https://mens-circle.de" target="_blank"><img src="https://mens-circle.de/images/logo-mail.png" width="36" height="36" alt="" style="display:block;width:36px;height:36px;"></a></td>
          <td style="vertical-align:middle;">
            <div class="em-serif" style="font-family:'Cormorant',Georgia,'Times New Roman',serif;font-size:21px;font-weight:500;line-height:1.2;letter-spacing:-0.01em;color:#f4f1ea;">Männerkreis</div>
          </td>
        </tr></table>
        <!-- The opening, as on the site: label and title at poster size on the dark ground -->
        <p class="em-sans" style="margin:44px 0 12px;font-family:'Geist','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;line-height:1.3;color:#c8603a;">Benachrichtigung</p>
        <h1 class="em-display em-serif" style="margin:0;font-family:'Cormorant',Georgia,'Times New Roman',serif;font-size:50px;font-weight:500;line-height:1.02;letter-spacing:-0.02em;color:#f4f1ea;">Neue Anmeldung.</h1>
    </td></tr></table>
    <!--[if mso]></td></tr></table><![endif]-->
  </td></tr>
  <!-- A paper band: its ground runs from edge to edge, its content stands on the 600px column -->
  <tr><td align="center" bgcolor="#f4f1ea" style="background-color:#f4f1ea;">
    <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
    <table role="presentation" class="em-sheet" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;"><tr><td class="em-pad" style="padding:40px 40px 36px;">
<p class="em-sans" style="margin:0 0 24px;font-family:'Geist','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:17px;line-height:1.65;color:#141210;"><strong style="font-weight:600;color:#141210;">${e(d.eventTitle)}</strong></p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;border-bottom:1px solid #d7d4ce;">
      <tr>
        <td width="110" class="em-key em-sans" style="width:110px;padding:11px 12px 11px 0;border-top:1px solid #d7d4ce;vertical-align:top;font-family:'Geist','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;line-height:24px;color:#605e5a;">Name</td>
        <td class="em-sans" style="padding:11px 0;border-top:1px solid #d7d4ce;vertical-align:top;font-family:'Geist','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;line-height:24px;color:#141210;">${e(d.participantName)}</td>
      </tr>
      <tr>
        <td width="110" class="em-key em-sans" style="width:110px;padding:11px 12px 11px 0;border-top:1px solid #d7d4ce;vertical-align:top;font-family:'Geist','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;line-height:24px;color:#605e5a;">E-Mail</td>
        <td class="em-sans" style="padding:11px 0;border-top:1px solid #d7d4ce;vertical-align:top;font-family:'Geist','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;line-height:24px;color:#141210;"><a href="mailto:${e(d.participantEmail)}" class="em-link" style="color:#141210;text-decoration:underline;text-underline-offset:3px;white-space:nowrap;">${e(d.participantEmail)}</a></td>
      </tr>
${
  d.participantPhone
    ? `
      <tr>
        <td width="110" class="em-key em-sans" style="width:110px;padding:11px 12px 11px 0;border-top:1px solid #d7d4ce;vertical-align:top;font-family:'Geist','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;line-height:24px;color:#605e5a;">Telefon</td>
        <td class="em-sans" style="padding:11px 0;border-top:1px solid #d7d4ce;vertical-align:top;font-family:'Geist','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;line-height:24px;color:#141210;">${e(d.participantPhone)}</td>
      </tr>
`
    : ''
}
      <tr>
        <td width="110" class="em-key em-sans" style="width:110px;padding:11px 12px 11px 0;border-top:1px solid #d7d4ce;vertical-align:top;font-family:'Geist','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;line-height:24px;color:#605e5a;">Status</td>
        <td class="em-sans" style="padding:11px 0;border-top:1px solid #d7d4ce;vertical-align:top;font-family:'Geist','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;line-height:24px;color:#141210;">${e(d.statusLabel)}</td>
      </tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;border-bottom:1px solid #d7d4ce;">
      <tr>
        <td width="110" class="em-key em-sans" style="width:110px;padding:11px 12px 11px 0;border-top:1px solid #d7d4ce;vertical-align:top;font-family:'Geist','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;line-height:24px;color:#605e5a;">Datum</td>
        <td class="em-sans" style="padding:11px 0;border-top:1px solid #d7d4ce;vertical-align:top;font-family:'Geist','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;line-height:24px;color:#141210;">${e(d.dateShort)}</td>
      </tr>
${
  d.timeRange
    ? `
      <tr>
        <td width="110" class="em-key em-sans" style="width:110px;padding:11px 12px 11px 0;border-top:1px solid #d7d4ce;vertical-align:top;font-family:'Geist','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;line-height:24px;color:#605e5a;">Uhrzeit</td>
        <td class="em-sans" style="padding:11px 0;border-top:1px solid #d7d4ce;vertical-align:top;font-family:'Geist','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;line-height:24px;color:#141210;">${e(d.timeRange)}</td>
      </tr>
`
    : ''
}
${
  d.location
    ? `
      <tr>
        <td width="110" class="em-key em-sans" style="width:110px;padding:11px 12px 11px 0;border-top:1px solid #d7d4ce;vertical-align:top;font-family:'Geist','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;line-height:24px;color:#605e5a;">Ort</td>
        <td class="em-sans" style="padding:11px 0;border-top:1px solid #d7d4ce;vertical-align:top;font-family:'Geist','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;line-height:24px;color:#141210;">${e(d.location)}</td>
      </tr>
`
    : ''
}
</table>
<!-- The count: open between two rules -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:2px 0 0;">
  <tr><td style="padding:22px 0;border-top:1px solid #bebbb6;border-bottom:1px solid #bebbb6;">
    <p class="em-serif" style="margin:0;font-family:'Cormorant',Georgia,'Times New Roman',serif;font-size:44px;font-weight:500;line-height:1;color:#141210;">${e(d.activeCount)}<span style="color:#605e5a;font-size:24px;">&nbsp;von&nbsp;${e(d.maxParticipants)}</span></p>
    <p class="em-sans" style="margin:10px 0 0;font-family:'Geist','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;line-height:1.3;color:#605e5a;">Plätzen belegt</p>
  </td></tr>
</table>
${
  d.adminUrl
    ? `
<!-- The one action: to the evening's registrations -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0;">
  <tr><td bgcolor="#c8603a" style="background-color:#c8603a;border-radius:999px;">
    <a href="${e(d.adminUrl)}" target="_blank" class="em-sans" style="display:inline-block;padding:15px 28px;font-family:'Geist','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;font-weight:600;line-height:1.1;color:#141210;text-decoration:none;border-radius:999px;">Anmeldungen ansehen&nbsp;&nbsp;&rarr;</a>
  </td></tr>
</table>
`
    : ''
}
    </td></tr></table>
    <!--[if mso]></td></tr></table><![endif]-->
  </td></tr>
  <!-- A dark band: its ground runs from edge to edge, its content stands on the 600px column -->
  <tr><td align="center" bgcolor="#141210" style="background-color:#141210;">
    <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
    <table role="presentation" class="em-sheet" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;"><tr><td class="em-pad" style="padding:18px 40px 22px;">
        <p class="em-sans" style="margin:0;font-family:'Geist','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#a8a5a0;">Automatische Benachrichtigung von <a href="https://mens-circle.de/admin" target="_blank" style="color:#c8603a;text-decoration:none;">mens-circle.de</a></p>
    </td></tr></table>
    <!--[if mso]></td></tr></table><![endif]-->
  </td></tr>
</table>
</body>
</html>
`
