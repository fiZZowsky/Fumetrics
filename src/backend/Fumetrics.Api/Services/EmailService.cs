using System.Net;
using System.Net.Mail;
using Fumetrics.Api.Configuration;
using Microsoft.Extensions.Options;

namespace Fumetrics.Api.Services;

public class EmailService(IOptions<SmtpOptions> options, ILogger<EmailService> logger)
{
    private readonly SmtpOptions _config = options.Value;

    public async Task SendEmailAsync(string toEmails, string subject, string htmlBody)
    {
        try
        {
            if (string.IsNullOrEmpty(_config.Host) || string.IsNullOrEmpty(_config.Username))
                return;

            using var client = new SmtpClient(_config.Host, _config.Port)
            {
                Credentials = new NetworkCredential(_config.Username, _config.Password),
                EnableSsl = true
            };

            var mailMessage = new MailMessage { From = new MailAddress(_config.From), Subject = subject, Body = htmlBody, IsBodyHtml = true };

            foreach (var email in toEmails.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries))
            {
                if (MailAddress.TryCreate(email.Trim(), out var address)) mailMessage.To.Add(address);
            }

            if (mailMessage.To.Count > 0)
                await client.SendMailAsync(mailMessage);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Błąd wysyłki e-mail.");
        }
    }
}