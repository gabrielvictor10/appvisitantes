<<<<<<< HEAD
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
=======
document.addEventListener("DOMContentLoaded", function () {
  const nameInput = document.getElementById("name");
  const phoneInput = document.getElementById("phone");
  const firstTimeCheckbox = document.getElementById("firstTime");
  const addVisitorBtn = document.getElementById("addVisitorBtn");
  const visitorList = document.getElementById("visitorList");
  const selectedDateInput = document.getElementById("selectedDate");
  const viewDateInput = document.getElementById("viewDate");
  const dateViewSpan = document.getElementById("dateView");
  const downloadBtn = document.getElementById("downloadBtn");

  let visitors = JSON.parse(localStorage.getItem("churchVisitors") || "[]");

  function formatDate(date) {
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function updateViewDate() {
    const selectedViewDate = viewDateInput.value;
    dateViewSpan.textContent = selectedViewDate
      ? formatDate(new Date(selectedViewDate))
      : "Selecione uma data";

    const filteredVisitors = visitors.filter(
      (v) => v.date === formatDate(new Date(selectedViewDate))
    );

    visitorList.innerHTML = filteredVisitors.length
      ? filteredVisitors
          .map(
            (v) =>
              `<li>
                <p>${v.name} - ${v.phone} ${
                v.isFirstTime ? "(Primeira vez)" : ""
              }</p>
                <button class="remove-btn" data-id="${v.id}">Remover</button>
              </li>`
          )
          .join("")
      : "<li>Nenhum visitante registrado nesta data.</li>";

    document.querySelectorAll(".remove-btn").forEach((btn) => {
      btn.addEventListener("click", function () {
        const visitorId = parseInt(this.getAttribute("data-id"));
        visitors = visitors.filter((v) => v.id !== visitorId);
        localStorage.setItem("churchVisitors", JSON.stringify(visitors));
        updateViewDate();
      });
    });
  }

  addVisitorBtn.addEventListener("click", function () {
    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();
    const date = selectedDateInput.value;

    if (!name || !phone || !date) {
      alert("Preencha todos os campos e selecione uma data.");
      return;
    }

    const newVisitor = {
      id: Date.now(),
      name,
      phone,
      isFirstTime: firstTimeCheckbox.checked,
      date: formatDate(new Date(date)),
    };

    visitors.push(newVisitor);
    localStorage.setItem("churchVisitors", JSON.stringify(visitors));

    nameInput.value = "";
    phoneInput.value = "";
    firstTimeCheckbox.checked = false;
    updateViewDate();
  });

  viewDateInput.addEventListener("change", updateViewDate);

  downloadBtn.addEventListener("click", function () {
    const selectedViewDate = viewDateInput.value;
    const filteredVisitors = visitors.filter(
      (v) => v.date === formatDate(new Date(selectedViewDate))
    );

    if (filteredVisitors.length === 0) {
      alert("Não há visitantes para baixar nesta data.");
      return;
    }

    const text = filteredVisitors
      .map((v) => `Nome: ${v.name}\nTelefone: ${v.phone}\n`)
      .join("\n");

    const blob = new Blob([text], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Visitantes_${selectedViewDate}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  updateViewDate();
});
>>>>>>> 2d37ba214d79f2d07053816ebfcc90a11a352fc2
