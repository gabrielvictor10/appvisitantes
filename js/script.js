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
            // Converter formato do Supabase para o formato do localStorage
            const formattedData = data.map(visitor => ({
                id: visitor.id || Date.now(),
                name: visitor.name,
                phone: visitor.phone,
                isFirstTime: visitor.isFirstTime,
                date: visitor.date,
                created_at: visitor.created_at || new Date().toISOString(),
                updated_at: visitor.updated_at || new Date().toISOString(),
                synced: true
            }));
            
            // Mescla dados do localStorage com Supabase, mantendo versões mais recentes
            const mergedVisitors = [];
            const allIds = new Set([
                ...visitors.map(v => v.id.toString()), 
                ...formattedData.map(v => v.id.toString())
            ]);
            
            allIds.forEach(id => {
                const localVisitor = visitors.find(v => v.id.toString() === id);
                const remoteVisitor = formattedData.find(v => v.id.toString() === id);
                
                if (localVisitor && remoteVisitor) {
                    // Usa timestamp para determinar qual versão é mais recente
                    const localUpdated = localVisitor.updated_at ? new Date(localVisitor.updated_at) : new Date(0);
                    const remoteUpdated = remoteVisitor.updated_at ? new Date(remoteVisitor.updated_at) : new Date(0);
                    
                    if (localUpdated > remoteUpdated && localVisitor.modified) {
                        // O local é mais recente e foi modificado
                        mergedVisitors.push(localVisitor);
                    } else {
                        // O remoto é mais recente ou o local não foi modificado
                        mergedVisitors.push(remoteVisitor);
                    }
                } else if (localVisitor) {
                    // Registros que existem apenas localmente
                    if (localVisitor.deleted) {
                        // Se marcado como excluído, não incluir na mesclagem
                    } else {
                        mergedVisitors.push(localVisitor);
                    }
                } else if (remoteVisitor) {
                    // Registros que existem apenas remotamente
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

// Sincronizar visitantes para o Supabase - FUNÇÃO OTIMIZADA
async function syncVisitorsToSupabase() {
    if (!supabaseEnabled) return;
    
    try {
        // Verifica quais visitantes precisam ser sincronizados
        // Um visitante precisa ser sincronizado se foi modificado ou nunca foi sincronizado
        const pendingVisitors = visitors.filter(v => v.modified || !v.synced);
        const deletedVisitors = JSON.parse(localStorage.getItem('deletedVisitors') || '[]');
        
        // Processa primeiro as exclusões
        if (deletedVisitors.length > 0) {
            for (const deletedId of deletedVisitors) {
                const { error: deleteError } = await supabase
                    .from('visitors')
                    .delete()
                    .eq('id', deletedId);
                
                if (deleteError) {
                    console.error("Erro ao excluir visitante no Supabase:", deleteError);
                }
            }
            // Limpa a lista de excluídos após processar
            localStorage.setItem('deletedVisitors', '[]');
        }
        
        // Processa as atualizações e inserções
        if (pendingVisitors.length > 0) {
            for (const visitor of pendingVisitors) {
                // Prepara o objeto para upsert, garantindo que os campos timestamp estão presentes
                const visitorToSync = {
                    ...visitor,
                    updated_at: new Date().toISOString(),
                    created_at: visitor.created_at || new Date().toISOString()
                };
                
                // Remove flags de controle interno que não devem ir para o banco
                delete visitorToSync.modified;
                delete visitorToSync.synced;
                
                // Verifica se o registro já existe
                const { data: existingData } = await supabase
                    .from('visitors')
                    .select('id')
                    .eq('id', visitor.id);
                
                if (!existingData || existingData.length === 0) {
                    // Insere novo registro
                    const { error: insertError } = await supabase
                        .from('visitors')
                        .insert([visitorToSync]);
                    
                    if (insertError) throw insertError;
                } else {
                    // Atualiza registro existente
                    const { error: updateError } = await supabase
                        .from('visitors')
                        .update(visitorToSync)
                        .eq('id', visitor.id);
                    
                    if (updateError) throw updateError;
                }
                
                // Marca o registro como sincronizado no array local
                visitor.synced = true;
                visitor.modified = false;
            }
            
            // Atualiza o localStorage com as flags atualizadas
            localStorage.setItem('churchVisitors', JSON.stringify(visitors));
        }
    } catch (error) {
        console.error("Erro ao sincronizar com Supabase:", error);
        // Em caso de erro, marca visitantes como não sincronizados para tentar novamente depois
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
    
    const timestamp = new Date().toISOString();
    const newVisitor = {
        id: Date.now(),
        name,
        phone,
        isFirstTime,
        date: formatDate(selectedDate),
        created_at: timestamp,
        updated_at: timestamp,
        synced: false,
        modified: true
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
    // Encontra o visitante antes de removê-lo para verificar se está no Supabase
    const visitorToRemove = visitors.find(visitor => visitor.id === id);
    const wasInSupabase = visitorToRemove && visitorToRemove.synced;
    
    // Remove do array local
    visitors = visitors.filter(visitor => visitor.id !== id);
    
    // Se estava sincronizado com Supabase, adiciona à lista de exclusão pendente
    if (wasInSupabase) {
        const deletedVisitors = JSON.parse(localStorage.getItem('deletedVisitors') || '[]');
        deletedVisitors.push(id);
        localStorage.setItem('deletedVisitors', JSON.stringify(deletedVisitors));
    }
    
    saveVisitors(); // Salva no localStorage
    
    // Se Supabase estiver disponível, tenta remover imediatamente
    if (supabaseEnabled && wasInSupabase) {
        try {
            const { error } = await supabase
                .from('visitors')
                .delete()
                .eq('id', id);
                
            if (error) throw error;
            
            // Se foi bem-sucedido, remove da lista de pendentes
            const deletedVisitors = JSON.parse(localStorage.getItem('deletedVisitors') || '[]');
            localStorage.setItem('deletedVisitors', JSON.stringify(
                deletedVisitors.filter(deletedId => deletedId !== id)
            ));
        } catch (error) {
            console.error("Erro ao remover visitante do Supabase:", error);
            // O item permanece na lista de exclusão pendente para tentar novamente depois
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
        
        // Indica se o registro está sincronizado
        if (!visitor.synced) {
            const syncBadge = document.createElement('div');
            syncBadge.className = 'sync-badge';
            syncBadge.textContent = 'Não sincronizado';
            syncBadge.style.fontSize = '0.7em';
            syncBadge.style.color = '#999';
            visitorInfo.appendChild(syncBadge);
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

// Implementa tentativa automática de sincronização
function setupAutoSync() {
    // Tenta sincronizar a cada minuto se houver dados pendentes
    setInterval(() => {
        if (supabaseEnabled) {
            const pendingVisitors = visitors.filter(v => v.modified || !v.synced);
            const deletedVisitors = JSON.parse(localStorage.getItem('deletedVisitors') || '[]');
            
            if (pendingVisitors.length > 0 || deletedVisitors.length > 0) {
                console.log("Tentando sincronização automática...");
                syncVisitorsToSupabase();
            }
        }
    }, 60000); // Tenta a cada 1 minuto
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

// Adicionar evento para sincronizar quando a conectividade é recuperada
window.addEventListener('online', () => {
    if (supabaseEnabled) {
        console.log("Conexão de rede recuperada. Tentando sincronizar...");
        syncVisitorsToSupabase();
    }
});

// Inicializar aplicação
initializeDates();
initializeRealtime(); // Inicia tempo real apenas se Supabase estiver disponível
loadVisitors(); // Carrega do localStorage e sincroniza com Supabase se disponível
setupAutoSync(); // Configura sincronização automática
