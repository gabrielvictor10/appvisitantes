// Estado da aplicação
let visitors = [];
let selectedDate = new Date();
let viewDate = new Date();

// Inicialização do Supabase
const supabaseUrl = 'https://qdttsbnsijllhkgrpdmc.supabase.co'; // Substitua pela sua URL do Supabase
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkdHRzYm5zaWpsbGhrZ3JwZG1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDExOTQzNDgsImV4cCI6MjA1Njc3MDM0OH0.CuZdeCC2wK73CrTt2cMIKxj20hAtgz_8qAhFt1EKkCw'; // Substitua pela sua chave pública do Supabase
const supabase = window.supabase ? window.supabase.createClient(supabaseUrl, supabaseKey) : null;
let supabaseEnabled = !!window.supabase;

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

// Inicializar tempo real para sincronismo (apenas se Supabase estiver disponível)
function initializeRealtime() {
    if (!supabaseEnabled) return;
    
    // Inscrever-se nas mudanças da tabela visitors
    const subscription = supabase
        .channel('visitors-channel')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'visitors' }, 
            payload => {
                syncVisitorsFromSupabase(); // Sincronizar visitantes quando houver alterações
            }
        )
        .subscribe();
}

// Carregar visitantes do localStorage
function loadVisitors() {
    const savedVisitors = JSON.parse(localStorage.getItem('churchVisitors') || '[]');
    visitors = savedVisitors;
    renderVisitorsList();
    
    // Se Supabase estiver disponível, também sincroniza dados
    if (supabaseEnabled) {
        syncVisitorsFromSupabase();
    }
}

// Sincronizar visitantes do Supabase
async function syncVisitorsFromSupabase() {
    if (!supabaseEnabled) return;
    
    try {
        // Busca todos os visitantes no Supabase
        const { data, error } = await supabase
            .from('visitors')
            .select('*');
            
        if (error) throw error;
        
        // Se tiver dados do Supabase
        if (data && data.length > 0) {
            // Converter formato do Supabase para o formato do localStorage se necessário
            const formattedData = data.map(visitor => ({
                id: visitor.id || Date.now(),
                name: visitor.name,
                phone: visitor.phone,
                isFirstTime: visitor.isFirstTime,
                date: visitor.date
            }));
            
            // Mescla dados do localStorage com Supabase, mantendo versões mais recentes
            // Aqui estamos assumindo que IDs iguais referem-se ao mesmo registro
            const mergedVisitors = [];
            const allIds = new Set([
                ...visitors.map(v => v.id.toString()), 
                ...formattedData.map(v => v.id.toString())
            ]);
            
            allIds.forEach(id => {
                const localVisitor = visitors.find(v => v.id.toString() === id);
                const remoteVisitor = formattedData.find(v => v.id.toString() === id);
                
                if (localVisitor && remoteVisitor) {
                    // Se temos ambos, pegamos o mais recente
                    // Aqui seria ideal ter um timestamp para comparação
                    mergedVisitors.push(remoteVisitor); // Priorizando dados do servidor
                } else if (localVisitor) {
                    mergedVisitors.push(localVisitor);
                } else if (remoteVisitor) {
                    mergedVisitors.push(remoteVisitor);
                }
            });
            
            visitors = mergedVisitors;
            saveVisitors(false); // Salva no localStorage, mas não reenvia para Supabase
            renderVisitorsList();
        }
    } catch (error) {
        console.error("Erro ao sincronizar com Supabase:", error);
        // Continua usando dados do localStorage em caso de erro
    }
}

// Salvar visitantes no localStorage e opcionalmente no Supabase
function saveVisitors(syncToSupabase = true) {
    // Sempre salva no localStorage
    localStorage.setItem('churchVisitors', JSON.stringify(visitors));
    
    // Sincroniza com Supabase se habilitado e solicitado
    if (supabaseEnabled && syncToSupabase) {
        syncVisitorsToSupabase();
    }
}

// Sincronizar visitantes para o Supabase
async function syncVisitorsToSupabase() {
    if (!supabaseEnabled) return;
    
    try {
        // Poderíamos implementar uma lógica mais complexa aqui para sincronizar
        // apenas registros novos ou modificados, mas por simplicidade vamos apenas
        // enviar o visitante mais recente, assumindo que ele acabou de ser adicionado
        
        if (visitors.length > 0) {
            const latestVisitor = visitors[visitors.length - 1];
            
            // Verifica se este visitante já existe no Supabase
            const { data: existingData } = await supabase
                .from('visitors')
                .select('id')
                .eq('id', latestVisitor.id);
                
            if (!existingData || existingData.length === 0) {
                // Se não existe, insere
                const { error: insertError } = await supabase
                    .from('visitors')
                    .insert([latestVisitor]);
                
                if (insertError) throw insertError;
            }
        }
    } catch (error) {
        console.error("Erro ao sincronizar com Supabase:", error);
        // Continua salvando no localStorage mesmo se falhar no Supabase
    }
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
        id: Date.now(),
        name,
        phone,
        isFirstTime,
        date: formatDate(selectedDate)
    };
    
    visitors.push(newVisitor);
    saveVisitors(); // Isso vai salvar no localStorage e sincronizar com Supabase
    
    // Limpar campos
    nameInput.value = '';
    phoneInput.value = '';
    firstTimeCheckbox.checked = false;
    
    // Atualizar lista se a data de visualização for a mesma da inclusão
    if (formatDate(selectedDate) === formatDate(viewDate)) {
        renderVisitorsList();
    }
}

// Remover visitante
async function removeVisitor(id) {
    visitors = visitors.filter(visitor => visitor.id !== id);
    saveVisitors(); // Salva no localStorage
    
    // Se Supabase estiver disponível, também remove lá
    if (supabaseEnabled) {
        try {
            const { error } = await supabase
                .from('visitors')
                .delete()
                .eq('id', id);
                
            if (error) throw error;
        } catch (error) {
            console.error("Erro ao remover visitante do Supabase:", error);
            // Continua o fluxo mesmo se falhar no Supabase
        }
    }
    
    renderVisitorsList();
}

// Renderizar lista de visitantes
function renderVisitorsList() {
    // Filtrar visitantes pela data selecionada para visualização
    const filteredVisitors = visitors.filter(v => 
        v.date === formatDate(viewDate)
    );
    
    // Limpar lista
    visitorsList.innerHTML = '';
    
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
        removeButton.addEventListener('click', () => removeVisitor(visitor.id));
        
        visitorItem.appendChild(visitorInfo);
        visitorItem.appendChild(removeButton);
        
        visitorsList.appendChild(visitorItem);
    });
    
    // Atualizar estatísticas
    totalVisitorsCount.textContent = filteredVisitors.length;
    firstTimeVisitorsCount.textContent = filteredVisitors.filter(v => v.isFirstTime).length;
}

// Gerar texto para download
function generateDownloadText() {
    const filteredVisitors = visitors.filter(v => 
        v.date === formatDate(viewDate)
    );
    
    const header = `Visitantes - ${formatDate(viewDate)}\n\n`;
    const visitorsList = filteredVisitors.map(v => 
        `Nome: ${v.name}\nTelefone: ${v.phone}\nPrimeira Vez: ${v.isFirstTime ? 'Sim' : 'Não'}\n---`
    ).join('\n');
    
    const totalStats = `\n\nTotal de Visitantes: ${filteredVisitors.length}\n` +
        `Visitantes pela Primeira Vez: ${filteredVisitors.filter(v => v.isFirstTime).length}`;
    
    return header + visitorsList + totalStats;
}

// Baixar lista como texto
function downloadVisitorsList() {
    const filteredVisitors = visitors.filter(v => 
        v.date === formatDate(viewDate)
    );
    
    if (filteredVisitors.length === 0) {
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
    renderVisitorsList();
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
initializeRealtime(); // Inicia tempo real apenas se Supabase estiver disponível
loadVisitors(); // Carrega do localStorage e sincroniza com Supabase se disponível
