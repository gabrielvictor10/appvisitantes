// Estado da aplicação
let visitors = [];
let selectedDate = new Date();
let viewDate = new Date();

// Inicialização do Supabase
const supabaseUrl = 'https://qdttsbnsijllhkgrpdmc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkdHRzYm5zaWpsbGhrZ3JwZG1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDExOTQzNDgsImV4cCI6MjA1Njc3MDM0OH0.CuZdeCC2wK73CrTt2cMIKxj20hAtgz_8qAhFt1EKkCw';
const supabase = window.supabase ? window.supabase.createClient(supabaseUrl, supabaseKey) : null;
let supabaseEnabled = !!window.supabase;

// Elementos do DOM
const DOM = {
    selectedDateText: document.getElementById('selectedDateText'),
    selectedDateInput: document.getElementById('selectedDateInput'),
    datePickerDropdown: document.getElementById('datePickerDropdown'),
    dateSelectorBtn: document.getElementById('dateSelectorBtn'),
    viewDateText: document.getElementById('viewDateText'),
    viewDateInput: document.getElementById('viewDateInput'),
    viewDatePickerDropdown: document.getElementById('viewDatePickerDropdown'),
    viewDateSelectorBtn: document.getElementById('viewDateSelectorBtn'),
    nameInput: document.getElementById('nameInput'),
    phoneInput: document.getElementById('phoneInput'),
    firstTimeCheckbox: document.getElementById('firstTimeCheckbox'),
    addVisitorBtn: document.getElementById('addVisitorBtn'),
    downloadBtn: document.getElementById('downloadBtn'),
    visitorsList: document.getElementById('visitorsList'),
    totalVisitorsCount: document.getElementById('totalVisitorsCount'),
    firstTimeVisitorsCount: document.getElementById('firstTimeVisitorsCount')
};

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

// Gerenciamento de dados
const DataManager = {
    async load() {
        visitors = JSON.parse(localStorage.getItem('churchVisitors') || '[]');
        renderVisitorsList();
        
        if (supabaseEnabled) {
            await this.syncFromSupabase();
            this.initializeRealtime();
        }
    },
    
    async save(syncToSupabase = true) {
        localStorage.setItem('churchVisitors', JSON.stringify(visitors));
        
        if (supabaseEnabled && syncToSupabase) {
            await this.syncToSupabase();
        }
    },
    
    async syncFromSupabase() {
        if (!supabaseEnabled) return;
        
        try {
            const { data, error } = await supabase.from('visitors').select('*');
            
            if (error) throw error;
            
            if (data && data.length > 0) {
                const remoteVisitors = data.map(visitor => ({
                    id: visitor.id || Date.now(),
                    name: visitor.name,
                    phone: visitor.phone,
                    isFirstTime: visitor.isFirstTime,
                    date: visitor.date
                }));
                
                // Mesclagem eficiente usando Map
                const visitorMap = new Map();
                
                // Adiciona visitantes locais ao Map
                visitors.forEach(v => visitorMap.set(v.id.toString(), v));
                
                // Substitui ou adiciona visitantes remotos
                remoteVisitors.forEach(v => visitorMap.set(v.id.toString(), v));
                
                visitors = Array.from(visitorMap.values());
                this.save(false);
                renderVisitorsList();
            }
        } catch (error) {
            console.error("Erro ao sincronizar com Supabase:", error);
        }
    },
    
    async syncToSupabase() {
        if (!supabaseEnabled) return;
        
        try {
            // Otimização: envia apenas o visitante mais recente
            if (visitors.length > 0) {
                const latestVisitor = visitors[visitors.length - 1];
                
                const { data: existingData } = await supabase
                    .from('visitors')
                    .select('id')
                    .eq('id', latestVisitor.id);
                    
                if (!existingData || existingData.length === 0) {
                    await supabase.from('visitors').insert([latestVisitor]);
                }
            }
        } catch (error) {
            console.error("Erro ao sincronizar com Supabase:", error);
        }
    },
    
    initializeRealtime() {
        if (!supabaseEnabled) return;
        
        supabase
            .channel('visitors-channel')
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: 'visitors' }, 
                payload => {
                    this.syncFromSupabase();
                }
            )
            .subscribe();
    },
    
    async removeVisitor(id) {
        visitors = visitors.filter(visitor => visitor.id !== id);
        await this.save();
        
        if (supabaseEnabled) {
            try {
                await supabase.from('visitors').delete().eq('id', id);
            } catch (error) {
                console.error("Erro ao remover visitante do Supabase:", error);
            }
        }
        
        renderVisitorsList();
    }
};

// Gerenciamento da interface
const UIManager = {
    initializeDates() {
        selectedDate = adjustDate(new Date());
        viewDate = adjustDate(new Date());
        
        DOM.selectedDateText.textContent = `Data do Registro: ${formatDate(selectedDate)}`;
        DOM.viewDateText.textContent = `Visualizar Registros: ${formatDate(viewDate)}`;
        
        DOM.selectedDateInput.value = selectedDate.toISOString().split('T')[0];
        DOM.viewDateInput.value = viewDate.toISOString().split('T')[0];
    },
    
    setupEventListeners() {
        DOM.dateSelectorBtn.addEventListener('click', () => {
            DOM.datePickerDropdown.style.display = DOM.datePickerDropdown.style.display === 'none' ? 'block' : 'none';
            DOM.viewDatePickerDropdown.style.display = 'none';
        });
        
        DOM.selectedDateInput.addEventListener('change', (e) => {
            selectedDate = createDateFromString(e.target.value);
            DOM.selectedDateText.textContent = `Data do Registro: ${formatDate(selectedDate)}`;
            DOM.datePickerDropdown.style.display = 'none';
        });
        
        DOM.viewDateSelectorBtn.addEventListener('click', () => {
            DOM.viewDatePickerDropdown.style.display = DOM.viewDatePickerDropdown.style.display === 'none' ? 'block' : 'none';
            DOM.datePickerDropdown.style.display = 'none';
        });
        
        DOM.viewDateInput.addEventListener('change', (e) => {
            viewDate = createDateFromString(e.target.value);
            DOM.viewDateText.textContent = `Visualizar Registros: ${formatDate(viewDate)}`;
            DOM.viewDatePickerDropdown.style.display = 'none';
            renderVisitorsList();
        });
        
        DOM.addVisitorBtn.addEventListener('click', addVisitor);
        DOM.downloadBtn.addEventListener('click', downloadVisitorsList);
        
        // Fechar dropdowns ao clicar fora
        document.addEventListener('click', (e) => {
            if (!DOM.dateSelectorBtn.contains(e.target) && !DOM.datePickerDropdown.contains(e.target)) {
                DOM.datePickerDropdown.style.display = 'none';
            }
            
            if (!DOM.viewDateSelectorBtn.contains(e.target) && !DOM.viewDatePickerDropdown.contains(e.target)) {
                DOM.viewDatePickerDropdown.style.display = 'none';
            }
        });
    },
    
    downloadVisitorsList() {
        const filteredVisitors = visitors.filter(v => v.date === formatDate(viewDate));
        
        if (filteredVisitors.length === 0) {
            alert('Não há visitantes para baixar nesta data.');
            return;
        }
        
        const text = this.generateDownloadText(filteredVisitors);
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Visitantes_${formatDate(viewDate).replace(/\//g, '-')}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },
    
    generateDownloadText(filteredVisitors) {
        const header = `Visitantes - ${formatDate(viewDate)}\n\n`;
        const visitorsList = filteredVisitors.map(v => 
            `Nome: ${v.name}\nTelefone: ${v.phone}\nPrimeira Vez: ${v.isFirstTime ? 'Sim' : 'Não'}\n---`
        ).join('\n');
        
        const totalStats = `\n\nTotal de Visitantes: ${filteredVisitors.length}\n` +
            `Visitantes pela Primeira Vez: ${filteredVisitors.filter(v => v.isFirstTime).length}`;
        
        return header + visitorsList + totalStats;
    }
};

// Funções de manipulação de visitantes
function addVisitor() {
    const name = DOM.nameInput.value.trim();
    const phone = DOM.phoneInput.value.trim();
    const isFirstTime = DOM.firstTimeCheckbox.checked;
    
    if (!name || !phone) {
        alert('Por favor, preencha nome e telefone');
        return;
    }
    
    const newVisitor = {
        id: Date.now(),
        name,
        phone,
        isFirstTime,
        date: formatDate(selectedDate)
    };
    
    visitors.push(newVisitor);
    DataManager.save();
    
    // Limpar campos
    DOM.nameInput.value = '';
    DOM.phoneInput.value = '';
    DOM.firstTimeCheckbox.checked = false;
    
    // Atualizar lista se a data de visualização for a mesma da inclusão
    if (formatDate(selectedDate) === formatDate(viewDate)) {
        renderVisitorsList();
    }
}

function renderVisitorsList() {
    // Filtrar visitantes pela data selecionada para visualização
    const filteredVisitors = visitors.filter(v => v.date === formatDate(viewDate));
    
    // Limpar lista
    DOM.visitorsList.innerHTML = '';
    
    // Adicionar visitantes à lista
    filteredVisitors.forEach(visitor => {
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
        removeButton.addEventListener('click', () => DataManager.removeVisitor(visitor.id));
        
        visitorItem.appendChild(visitorInfo);
        visitorItem.appendChild(removeButton);
        
        DOM.visitorsList.appendChild(visitorItem);
    });
    
    // Atualizar estatísticas
    DOM.totalVisitorsCount.textContent = filteredVisitors.length;
    DOM.firstTimeVisitorsCount.textContent = filteredVisitors.filter(v => v.isFirstTime).length;
}

function downloadVisitorsList() {
    UIManager.downloadVisitorsList();
}

// Inicialização
function init() {
    UIManager.initializeDates();
    UIManager.setupEventListeners();
    DataManager.load();
}

// Iniciar aplicação
init();
