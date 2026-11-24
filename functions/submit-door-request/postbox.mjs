export async function sendEstimate({ token, env, contact, receipt, pdf, fetchImpl }) {
  const response = await fetchImpl('https://postbox.cloud.yandex.net/v2/email/outbound-emails', {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
    headers: { 'Content-Type': 'application/json', 'X-YaCloud-SubjectToken': token },
    body: JSON.stringify({
      FromEmailAddress: env.POSTBOX_FROM,
      Destination: { ToAddresses: [env.POSTBOX_TO] },
      Content: { Simple: {
        Subject: { Charset: 'UTF-8', Data: 'Заявка DOOR CONFIG ' + receipt.number },
        Body: { Text: { Charset: 'UTF-8', Data: [
          'Расчёт ' + receipt.number, 'Имя: ' + contact.name, 'Телефон: ' + contact.phone,
          'Email: ' + (contact.email || '—'), 'Комментарий: ' + (contact.comment || '—'),
          'Согласие подтверждено при отправке: ' + receipt.createdAt,
          'Предварительная стоимость: ' + receipt.snapshot.total + ' ₽. Смета приложена.',
        ].join('\n') } },
        Attachments: [{ FileName: receipt.number + '.pdf', RawContent: pdf.toString('base64'),
          ContentType: 'application/pdf', ContentDisposition: 'ATTACHMENT' }],
      } },
    }),
  })
  if (!response.ok || !(await response.json()).MessageId) throw Error('Postbox acceptance unconfirmed')
}
