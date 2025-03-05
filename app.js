// Configuração do Supabase
const SUPABASE_URL = "SUA_URL_DO_SUPABASE";
const SUPABASE_ANON_KEY = "SUA_CHAVE_ANONIMA";
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Adicionar visitante
document.getElementById("addVisitorBtn").addEventListener("click", async () => {
    const name = document.getElementById("name").value;
    const phone = document.getElementById("phone").value;
    const firstTime = document.getElementById("firstTime").checked;
    const date = new Date().toISOString().split("T")[0];

    if (!name) {
        alert("Por favor, preencha o nome.");
        return;
    }

    const { error } = await supabase.from("visitantes").insert([
        { nome: name, telefone: phone, primeira_vez: firstTime, data: date }
    ]);

    if (error) {
        alert("Erro ao adicionar visitante.");
    } else {
        alert("Visitante cadastrado com sucesso!");
        loadVisitors();
    }
});

// Carregar visitantes da data selecionada
document.getElementById("viewDate").addEventListener("change", loadVisitors);

async function loadVisitors() {
    const date = document.getElementById("viewDate").value;
    document.getElementById("dateView").textContent = date;

    const { data, error } = await supabase
        .from("visitantes")
        .select("*")
        .eq("data", date);

    if (error) {
        alert("Erro ao carregar visitantes.");
        return;
    }

    const list = document.getElementById("visitorList");
    list.innerHTML = "";

    if (data.length === 0) {
        list.innerHTML = "<li>Nenhum visitante registrado nesta data.</li>";
    } else {
        data.forEach(visitor => {
            const li = document.createElement("li");
            li.textContent = `${visitor.nome} - ${visitor.telefone} - ${visitor.primeira_vez ? "Primeira vez" : "Retorno"}`;
            list.appendChild(li);
        });
    }
}

// Carregar visitantes ao iniciar
document.addEventListener("DOMContentLoaded", loadVisitors);
