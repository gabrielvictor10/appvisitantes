// Estado da aplicação
let visitors = [];
let selectedDate = new Date();
let viewDate = new Date();

// Configuração do Firebase - Adicione estas linhas
const firebaseConfig = {
    apiKey: "AIzaSyA7MQhioNOIoO2mgsBnTy59a9izbuuR_20",
    authDomain: "semente-santa-visitantes.firebaseapp.com",
    projectId: "semente-santa-visitantes",
    storageBucket: "semente-santa-visitantes.firebasestorage.app",
    messagingSenderId: "1036982320274",
    appId: "1:1036982320274:web:ec547842c6f3da3bddba4b"
  };

// Inicializar Firebase - Adicione estas linhas
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Elementos do DOM
const selectedDateText = document.getElementById('selectedDateText');
const selectedDateInput = document.getElementById('selectedDateInput');
const datePickerDropdown = document.getElementById('datePickerDropdown');
const dateSelectorBtn = document.getElementById('dateSelectorBtn');

const viewDateText = document.getElementById('viewDateText');
const viewDateInput = document.getElementById('viewDateInput');
const viewDatePickerDropdown = document.getElementById('viewDatePickerDropdown');
const viewDateSelectorBtn = document.getElementById('viewDateSelectorBtn');

const nameInput = document.getElementById('nameInput');
const phoneInput = document.getElementById('phoneInput');
const firstTimeCheckbox = document.getElementById('firstTimeCheckbox');
const addVisitorBtn = document.getElementById('addVisitorBtn');
const downloadBtn = document.getElementById('downloadBtn');
const visitorsList = document.getElementById('visitorsList');
const totalVisitorsCount = document.getElementById('totalVisitorsCount');
const firstTimeVisitorsCount = document.getElementById('firstTimeVisitorsCount');

// Formatação de data no padrão brasileiro (dd/mm/yyyy)
function formatDate(date) {
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// Ajustar data para evitar problemas de fuso horário
function adjustDate(date) {
    // Corrigindo o problema de fuso horário com uma abordagem mais robusta
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    const adjusted = new Date(date.getTime() + userTimezoneOffset);
    adjusted.setHours(0, 0, 0, 0);
    return adjusted;
}

// Função para criar data a partir de string YYYY-MM-DD
function createDateFromString(dateString) {
    const [year, month, day] = dateString.split('-').map(num => parseInt(num, 10));
    return new Date(year, month - 1, day);
}

// Inicializar datas
function initializeDates() {
    selectedDate = adjustDate(new Date());
    viewDate = adjustDate(new Date());
    
    selectedDateText.textContent = `Data do Registro: ${formatDate(selectedDate)}`;
    viewDateText.textContent = `Visualizar Registros: ${formatDate(viewDate)}`;
    
    selectedDateInput.value = selectedDate.toISOString().split('T')[0];
    viewDateInput.value = viewDate.toISOString().split('T')[0];
}

// Carregar visitantes do Firestore
function loadVisitors() {
    // Atualiza o texto da UI antes de carregar
    viewDateText.textContent = `Visualizar Registros: ${formatDate(viewDate)}`;
    
    // Busca visitantes no Firestore com base na data selecionada
    db.collection("visitors")
        .where("date", "==", formatDate(viewDate))
        .onSnapshot((snapshot) => {
            visitors = [];
            snapshot.forEach((doc) => {
                visitors.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            renderVisitorsList();
        }, (error) => {
            console.error("Erro ao carregar visitantes:", error);
            alert("Erro ao carregar dados: " + error.message);
        });
}

// Adicionar novo visitante
function addVisitor() {
    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();
    const isFirstTime = firstTimeCheckbox.checked;
    
    if (!name || !phone) {
        alert('Por favor, preencha nome e telefone');
        return;
    }
    
    const newVisitor = {
        name,
        phone,
        isFirstTime,
        date: formatDate(selectedDate),
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    // Salvar no Firestore
    db.collection("visitors")
        .add(newVisitor)
        .then(() => {
            // Limpar campos
            nameInput.value = '';
            phoneInput.value = '';
            firstTimeCheckbox.checked = false;
            
            // Atualizar lista se a data de visualização for a mesma da inclusão
            if (formatDate(selectedDate) === formatDate(viewDate)) {
                // A lista será atualizada automaticamente pelo onSnapshot
            }
        })
        .catch((error) => {
            console.error("Erro ao adicionar visitante:", error);
            alert("Erro ao adicionar visitante: " + error.message);
        });
}

// Remover visitante
function removeVisitor(id) {
    db.collection("visitors")
        .doc(id)
        .delete()
        .catch((error) => {
            console.error("Erro ao remover visitante:", error);
            alert("Erro ao remover visitante: " + error.message);
        });
    // Não é necessário atualizar a lista manualmente, o onSnapshot fará isso
}

// Renderizar lista de visitantes
function renderVisitorsList() {
    // Limpar lista
    visitorsList.innerHTML = '';
    
    // Adicionar visitantes à lista
    visitors.forEach(visitor => {
        const visitorItem = document.createElement('div');
        visitorItem.className = 'visitor-item';
        
        const visitorInfo = document.createElement('div');
        visitorInfo.className = 'visitor-info';
        
        const visitorName = document.createElement('div');
        visitorName.className = 'visitor-name';
        visitorName.textContent = visitor.name;
        
        const visitorPhone = document.createElement('div');
        visitorPhone.className = 'visitor-phone';
        visitorPhone.textContent = visitor.phone;
        
        visitorInfo.appendChild(visitorName);
        visitorInfo.appendChild(visitorPhone);
        
        if (visitor.isFirstTime) {
            const firstTimeBadge = document.createElement('div');
            firstTimeBadge.className = 'first-time-badge';
            firstTimeBadge.textContent = 'Primeira Vez';
            visitorInfo.appendChild(firstTimeBadge);
        }
        
        const removeButton = document.createElement('button');
        removeButton.className = 'remove-button';
        removeButton.textContent = 'Remover';
        removeButton.addEventListener('click', () => removeVisitor(visitor.id));
        
        visitorItem.appendChild(visitorInfo);
        visitorItem.appendChild(removeButton);
        
        visitorsList.appendChild(visitorItem);
    });
    
    // Atualizar estatísticas
    totalVisitorsCount.textContent = visitors.length;
    firstTimeVisitorsCount.textContent = visitors.filter(v => v.isFirstTime).length;
}

// Gerar texto para download
function generateDownloadText() {
    const header = `Visitantes - ${formatDate(viewDate)}\n\n`;
    const visitorsList = visitors.map(v => 
        `Nome: ${v.name}\nTelefone: ${v.phone}\nPrimeira Vez: ${v.isFirstTime ? 'Sim' : 'Não'}\n---`
    ).join('\n');
    
    const totalStats = `\n\nTotal de Visitantes: ${visitors.length}\n` +
        `Visitantes pela Primeira Vez: ${visitors.filter(v => v.isFirstTime).length}`;
    
    return header + visitorsList + totalStats;
}

// Baixar lista como texto
function downloadVisitorsList() {
    if (visitors.length === 0) {
        alert('Não há visitantes para baixar nesta data.');
        return;
    }
    
    const blob = new Blob([generateDownloadText()], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Visitantes_${formatDate(viewDate).replace(/\//g, '-')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Event Listeners
dateSelectorBtn.addEventListener('click', () => {
    datePickerDropdown.style.display = datePickerDropdown.style.display === 'none' ? 'block' : 'none';
    viewDatePickerDropdown.style.display = 'none';
});

selectedDateInput.addEventListener('change', (e) => {
    const newDate = createDateFromString(e.target.value);
    selectedDate = newDate;
    selectedDateText.textContent = `Data do Registro: ${formatDate(selectedDate)}`;
    datePickerDropdown.style.display = 'none';
});

viewDateSelectorBtn.addEventListener('click', () => {
    viewDatePickerDropdown.style.display = viewDatePickerDropdown.style.display === 'none' ? 'block' : 'none';
    datePickerDropdown.style.display = 'none';
});

viewDateInput.addEventListener('change', (e) => {
    const newDate = createDateFromString(e.target.value);
    viewDate = newDate;
    viewDateText.textContent = `Visualizar Registros: ${formatDate(viewDate)}`;
    viewDatePickerDropdown.style.display = 'none';
    loadVisitors(); // Recarrega os visitantes com a nova data
});

addVisitorBtn.addEventListener('click', addVisitor);
downloadBtn.addEventListener('click', downloadVisitorsList);

// Clicar fora dos dropdowns fecha-os
document.addEventListener('click', (e) => {
    if (!dateSelectorBtn.contains(e.target) && !datePickerDropdown.contains(e.target)) {
        datePickerDropdown.style.display = 'none';
    }
    
    if (!viewDateSelectorBtn.contains(e.target) && !viewDatePickerDropdown.contains(e.target)) {
        viewDatePickerDropdown.style.display = 'none';
    }
});

// Inicializar aplicação
initializeDates();
loadVisitors();
