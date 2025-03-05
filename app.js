document.addEventListener("DOMContentLoaded", function () {
  // Configuração do Supabase
  const supabaseUrl = 'https://qdttsbnsijllhkgrpdmc.supabase.co>'; // Substitua com seu URL do Supabase
  const supabaseKey = '<eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkdHRzYm5zaWpsbGhrZ3JwZG1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDExOTQzNDgsImV4cCI6MjA1Njc3MDM0OH0.CuZdeCC2wK73CrTt2cMIKxj20hAtgz_8qAhFt1EKkCw>'; // Substitua com sua chave API
  const supabase = supabase.createClient(supabaseUrl, supabaseKey);

  const nameInput = document.getElementById("name");
  const phoneInput = document.getElementById("phone");
  const firstTimeCheckbox = document.getElementById("firstTime");
  const addVisitorBtn = document.getElementById("addVisitorBtn");
  const visitorList = document.getElementById("visitorList");
  const selectedDateInput = document.getElementById("selectedDate");
  const viewDateInput = document.getElementById("viewDate");
  const dateViewSpan = document.getElementById("dateView");
  const downloadBtn = document.getElementById("downloadBtn");

  // Função para formatar data
  function formatDate(date) {
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  // Atualiza a lista de visitantes conforme a data selecionada
  async function updateViewDate() {
    const selectedViewDate = viewDateInput.value;
    dateViewSpan.textContent = selectedViewDate
      ? formatDate(new Date(selectedViewDate))
      : "Selecione uma data";

    const { data, error } = await supabase
      .from('visitors')
      .select('*')
      .eq('date', formatDate(new Date(selectedViewDate)));

    if (error) {
      alert('Erro ao buscar visitantes: ' + error.message);
      return;
    }

    visitorList.innerHTML =
      data.length > 0
        ? data
            .map(
              (v) =>
                `<li>
                  <p>${v.name} - ${v.phone} ${v.isFirstTime ? "(Primeira vez)" : ""}</p>
                  <button class="remove-btn" data-id="${v.id}">Remover</button>
                </li>`
            )
            .join("")
        : "<li>Nenhum visitante registrado nesta data.</li>";

    // Lidar com o botão de remoção
    document.querySelectorAll(".remove-btn").forEach((btn) => {
      btn.addEventListener("click", async function () {
        const visitorId = this.getAttribute("data-id");
        const { error } = await supabase
          .from('visitors')
          .delete()
          .eq('id', visitorId);

        if (error) {
          alert('Erro ao remover visitante: ' + error.message);
          return;
        }

        updateViewDate(); // Atualiza a lista após a remoção
      });
    });
  }

  // Adiciona um novo visitante
  addVisitorBtn.addEventListener("click", async function () {
    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();
    const date = selectedDateInput.value;

    if (!name || !phone || !date) {
      alert("Preencha todos os campos e selecione uma data.");
      return;
    }

    const newVisitor = {
      name,
      phone,
      isFirstTime: firstTimeCheckbox.checked,
      date: formatDate(new Date(date)),
    };

    const { data, error } = await supabase
      .from('visitors')
      .insert([newVisitor]);

    if (error) {
      alert("Erro ao adicionar visitante: " + error.message);
      return;
    }

    // Limpa os campos e atualiza a lista
    nameInput.value = "";
    phoneInput.value = "";
    firstTimeCheckbox.checked = false;
    updateViewDate();
  });

  // Atualiza a visualização quando a data mudar
  viewDateInput.addEventListener("change", updateViewDate);

  // Baixa a lista de visitantes como um arquivo de texto
  downloadBtn.addEventListener("click", async function () {
    const selectedViewDate = viewDateInput.value;
    const { data, error } = await supabase
      .from('visitors')
      .select('*')
      .eq('date', formatDate(new Date(selectedViewDate)));

    if (error) {
      alert("Erro ao baixar visitantes: " + error.message);
      return;
    }

    if (data.length === 0) {
      alert("Não há visitantes para baixar nesta data.");
      return;
    }

    const text = data
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

  updateViewDate(); // Atualiza a visualização ao carregar a página
});
