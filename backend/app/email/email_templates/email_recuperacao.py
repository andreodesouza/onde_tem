def obter_html_recuperacao(codigo: str) -> str:
    return f"""
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Código de Recuperação — Onde Tem?</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f7; font-family: 'Poppins', Arial, sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f4f4f7; padding: 40px 0;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                    <tr>
                        <td align="center" style="background: linear-gradient(135deg, #553a73 0%, #3a254f 100%); padding: 30px 20px;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: 0.5px;">Onde Tem?</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px 30px; color: #333333; text-align: center;">
                            <h2 style="color: #222222; font-size: 20px; margin-top: 0; margin-bottom: 15px;">Redefinição de Senha</h2>
                            <p style="font-size: 15px; color: #666666; line-height: 1.5; margin-bottom: 30px;">
                                Recebemos um pedido para redefinir a palavra-passe da sua conta. Utilize o código de verificação abaixo:
                            </p>
                            <div style="background-color: #f8f6fc; border: 2px dashed #553a73; border-radius: 8px; padding: 20px; margin: 0 auto 30px auto; display: inline-block;">
                                <span style="font-size: 32px; font-weight: 700; color: #553a73; letter-spacing: 8px; display: inline-block;">{codigo}</span>
                            </div>
                            <p style="font-size: 14px; color: #888888; margin: 0;">
                                Insira este código de 6 dígitos na aplicação. Se não solicitou a alteração, pode ignorar este e-mail com segurança.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="background-color: #fafafa; padding: 20px; font-size: 12px; color: #aaaaaa; border-top: 1px solid #eeeeee;">
                            <p style="margin: 0;">© 2026 Onde Tem? Todos os direitos reservados.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""