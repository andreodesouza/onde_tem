const API_URL = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://127.0.0.1:8000"
    : "/api";

document.addEventListener("DOMContentLoaded", () => {
    const formLogin = document.getElementById("form-login");

    formLogin.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = document.getElementById("login-email").value.trim();
        const senha = document.getElementById("login-senha").value;
        const btnSubmit = formLogin.querySelector(".btn-start");

        try {
            btnSubmit.disabled = true;
            btnSubmit.textContent = "A entrar...";

            const resposta = await fetch(`${API_URL}/api/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: email,
                    senha: senha
                }),
            });

            const resultado = await resposta.json();

            if (resposta.ok) {
                // Guarda os dados e o token da sessão de forma unificada
                localStorage.setItem("token", resultado.token);
                localStorage.setItem("usuarioLogado", JSON.stringify(resultado.usuario));
                localStorage.setItem("usuario_logado", JSON.stringify(resultado.usuario));

                // REDIRECIONAMENTO CONDICIONAL:
                if (resultado.usuario.tipo === "empresa") {
                    // Empresa vai direto para o painel do salão
                    window.location.href = "salao_dashboard.html";
                } else {
                    // Cliente regressa à página inicial (app.html) para ver a cascata no cabeçalho
                    window.location.href = "app.html";
                }
            } else {
                alert(resultado.detail || "E-mail ou palavra-passe incorretos.");
            }
        } catch (error) {
            console.error("Erro ao conectar com o servidor:", error);
            alert("Não foi possível conectar ao servidor. Tente novamente mais tarde.");
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.textContent = "Entrar";
        }
    });
});