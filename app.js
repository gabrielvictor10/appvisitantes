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

  const totalVisitorsSpan = document.getElementById("totalVisitors");
  const firstTimeVisitorsSpan = document.getElementById("firstTimeVisitors");

  let visitors = JSON.parse(localStorage.getItem("churchVisitors") || "[]");

  function formatDate(date) {
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function updateStats() {
    const totalVisitors = visitors.length;
    const firstTimeVisitors = visitors.filter(v => v.isFirstTime).length;
    
    totalVisitorsSpan.textContent = totalVisitors;
    firstTimeVisitorsSpan.textContent = firstTimeVisitors;
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
                <p>${v.name} - ${v.phone} ${v.isFirstTime ? "(Primeira vez)" : ""}</p>
                <button class="remove-btn" data-id="${v.id}">Remover</button>
              </li>`
          )
          .join(" ")
      : "<li>Nenhum visitante registrado nesta data.</li>";

    document.querySelectorAll(".remove-btn").forEach((btn) => {
      btn.addEventListener("click", function () {
        const visitorId = parseInt(this.getAttribute("data-id"));
        visitors = visitors.filter((v) => v.id !== visitorId);
        localStorage.setItem("churchVisitors", JSON.stringify(visitors));
        updateStats(); // Atualiza as estatísticas após remover um visitante
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
    
    updateStats(); // Atualiza as estatísticas sempre que um visitante for adicionado
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

  updateStats(); // Inicializa as estatísticas ao carregar a página
  updateViewDate(); // Exibe os registros ao carregar a página
});
