import { useState, useEffect } from 'react';
import { Bell, X, Trash2, Edit2, Code, Eye, RefreshCw, Save } from 'lucide-react';
import { AlertRule, AgentStatusItem, EmailTemplate } from '@/types/fumetrics';

interface AlertsModalProps {
  uniqueMachines: string[];
  groupedAgents: Record<string, AgentStatusItem[]>;
  onClose: () => void;
}

const DEFAULT_TEMPLATE = `<div style="background-color: #030712; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="max-width: 620px; margin: 0 auto; background: linear-gradient(145deg, #0b1329 0%, #070a14 100%); border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);">
    <div style="padding: 32px 32px 24px 32px; border-bottom: 1px solid #1e293b; position: relative;">
      <div style="position: absolute; top: 0; left: 0; right: 0; height: 3px; background: {{Color}}; box-shadow: 0 0 15px {{Color}};"></div>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td>
            <span style="font-size: 10px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: #64748b; display: block; margin-bottom: 6px;">Fumetrics Telemetry Engine</span>
            <h1 style="color: #ffffff; font-size: 22px; font-weight: 800; margin: 0; letter-spacing: -0.5px;">{{Title}}</h1>
          </td>
          <td style="text-align: right; vertical-align: top;">
            <span style="background-color: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: {{Color}}; font-size: 11px; font-weight: 700; padding: 6px 12px; border-radius: 20px; display: inline-block;">
              ● SYSTEM ALERT
            </span>
          </td>
        </tr>
      </table>
    </div>
    <div style="padding: 32px;">
      <div style="background-color: #0f172a; border: 1px solid #334155; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding-bottom: 12px; color: #94a3b8; font-size: 12px; font-weight: 600; text-transform: uppercase; width: 35%;">Docelowy Serwer</td>
            <td style="padding-bottom: 12px; color: #f8fafc; font-size: 14px; font-weight: 700; font-family: monospace;">{{MachineName}}</td>
          </tr>
          <tr>
            <td style="padding-bottom: 12px; color: #94a3b8; font-size: 12px; font-weight: 600; text-transform: uppercase;">Monitorowany Obiekt</td>
            <td style="padding-bottom: 12px; color: #38bdf8; font-size: 14px; font-weight: 700; font-family: monospace;">{{Target}}</td>
          </tr>
          <tr>
            <td style="color: #94a3b8; font-size: 12px; font-weight: 600; text-transform: uppercase;">Wykryta Anomalia</td>
            <td style="color: {{Color}}; font-size: 14px; font-weight: 700;">{{Reason}}</td>
          </tr>
        </table>
      </div>
      <table style="width: 100%; border-collapse: separate; border-spacing: 12px 0; margin-left: -12px; margin-right: -12px; margin-bottom: 24px;">
        <tr>
          <td style="width: 50%; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 10px; padding: 16px; text-align: center;">
            <span style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 4px;">Zarejestrowana Wartość</span>
            <span style="font-size: 20px; font-weight: 800; color: {{Color}}; font-family: monospace;">{{CurrentValue}}</span>
          </td>
          <td style="width: 50%; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 10px; padding: 16px; text-align: center;">
            <span style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 4px;">Skonfigurowany Próg</span>
            <span style="font-size: 20px; font-weight: 800; color: #e2e8f0; font-family: monospace;">{{Threshold}}</span>
          </td>
        </tr>
      </table>
      <div style="border-top: 1px solid #1e293b; padding-top: 20px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; color: #94a3b8;">
          <tr>
            <td style="padding: 4px 0;">System operacyjny: <span style="color: #cbd5e1;">{{OsVersion}}</span></td>
            <td style="padding: 4px 0; text-align: right;">CPU Serwera: <span style="color: #cbd5e1;">{{MachineCpu}}%</span></td>
          </tr>
          <tr>
            <td style="padding: 4px 0;">Ostatnia synchronizacja: <span style="color: #cbd5e1;">{{LastUpdated}}</span></td>
            <td style="padding: 4px 0; text-align: right;">RAM / Dysk: <span style="color: #cbd5e1;">{{MachineRam}}% / {{MachineDisk}}%</span></td>
          </tr>
        </table>
      </div>
    </div>
    <div style="background-color: #070a14; padding: 20px 32px; border-top: 1px solid #1e293b; text-align: center;">
      <p style="margin: 0; font-size: 11px; color: #475569; line-height: 1.5;">
        Automatyczny komunikat wygenerowany przez <strong style="color: #64748b;">Fumetrics Core</strong>.<br/>
        Wszystkie prawa zastrzeżone © 2026. Prosimy nie odpowiadać na tę wiadomość.
      </p>
    </div>
  </div>
</div>`;

export function AlertsModal({ uniqueMachines, groupedAgents, onClose }: AlertsModalProps) {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [newRule, setNewRule] = useState<AlertRule>({ 
    machineName: '', serviceName: '', metric: 'State', threshold: 'STOPPED', email: '', 
    delayMinutes: 3, repeatMinutes: 60, htmlTemplate: DEFAULT_TEMPLATE 
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [previewMode, setPreviewMode] = useState<'alarm' | 'resolved'>('alarm');

  const [savedTemplates, setSavedTemplates] = useState<EmailTemplate[]>([]);
  const [templateName, setTemplateName] = useState('');

const fetchRules = async () => {
  try {
    const token = localStorage.getItem('fumetrics_jwt');
    const res = await fetch(`http://${window.location.hostname}:5170/api/metrics/alerts`, {
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json'
      }
    });
    if (res.ok) {
      const data = await res.json();
      setRules(data);
    }
  } catch (err) {
    console.error("Błąd pobierania reguł alertów", err);
  }
};

const fetchTemplates = async () => {
    try { 
      const res = await fetch(`http://${window.location.hostname}:5170/api/metrics/email-templates`); 
      if (res.ok) {
        const data = await res.json();
        setSavedTemplates(data);
      } else {
        console.error("Nie udało się pobrać szablonów, status:", res.status);
      }
    } catch (err) {
      console.error("Błąd sieci przy pobieraniu szablonów:", err);
    }
  };

  useEffect(() => { 
    fetchRules(); 
    fetchTemplates();
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'codeChange') {
        setNewRule(prev => ({ ...prev, htmlTemplate: event.data.code }));
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const saveRule = async () => {
    if (!newRule.machineName || !newRule.serviceName || !newRule.email || !newRule.threshold) {
      alert("Wypełnij wymagane pola!"); return;
    }
    const method = editingId ? 'PUT' : 'POST';
    await fetch(`http://${window.location.hostname}:5170/api/metrics/alerts`, { 
      method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('fumetrics_jwt')}` }, body: JSON.stringify(newRule) 
    });
    cancelEdit(); fetchRules();
  };

const saveTemplateToDb = async () => {
    if (!templateName.trim()) { alert("Podaj nazwę dla szablonu!"); return; }
    try {
      const response = await fetch(`http://${window.location.hostname}:5170/api/metrics/email-templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: templateName, htmlContent: newRule.htmlTemplate })
      });

      if (!response.ok) {
        throw new Error(`Serwer zwrócił błąd: ${response.status}`);
      }

      alert("Szablon został pomyślnie zapisany!");
      setTemplateName('');
      fetchTemplates();
    } catch (ex: any) { 
      alert("Błąd podczas zapisu szablonu: " + ex.message); 
    }
  };

const loadTemplate = (tmpl: EmailTemplate) => {
    setNewRule(prev => ({ ...prev, htmlTemplate: tmpl.htmlContent }));
    setTemplateName(tmpl.name);
    
    const iframeEl = document.getElementById('monaco-iframe') as HTMLIFrameElement;
    if (iframeEl && iframeEl.contentWindow) {
      iframeEl.contentWindow.postMessage({ type: 'setTemplate', code: tmpl.htmlContent }, '*');
    }
  };

  /*
  const deleteTemplate = async (id?: string) => {
    if (!id || !confirm("Usunąć ten szablon z bazy?")) return;
    try {
      await fetch(`http://${window.location.hostname}:5170/api/metrics/email-templates/${id}`, { method: 'DELETE' });
      fetchTemplates();
    } catch {}
  };
  */

  const removeRule = async (id: string) => {
    if(!confirm("Usunąć regułę?")) return;
    try { await fetch(`http://${window.location.hostname}:5170/api/metrics/alerts/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('fumetrics_jwt')}` } }); fetchRules(); } catch {}
  };

  const editRule = (rule: AlertRule) => { setNewRule({ ...rule, htmlTemplate: rule.htmlTemplate || DEFAULT_TEMPLATE }); setEditingId(rule.id!); };
  
  const cancelEdit = () => { 
    setNewRule({ machineName: '', serviceName: '', metric: 'State', threshold: 'STOPPED', email: '', delayMinutes: 3, repeatMinutes: 60, htmlTemplate: DEFAULT_TEMPLATE }); 
    setEditingId(null); setShowTemplateEditor(false); 
  };

  const getRenderedPreview = () => {
    const isAlarm = previewMode === 'alarm';
    return (newRule.htmlTemplate || DEFAULT_TEMPLATE)
      .replace(/\{\{Title\}\}/g, isAlarm ? '🚨 NOWY ALARM' : '✅ ROZWIĄZANO')
      .replace(/\{\{Color\}\}/g, isAlarm ? '#ef4444' : '#10b981')
      .replace(/\{\{MachineName\}\}/g, newRule.machineName || 'SRV-01')
      .replace(/\{\{Target\}\}/g, newRule.serviceName || 'Service')
      .replace(/\{\{Reason\}\}/g, isAlarm ? 'Wysokie zużycie CPU' : 'W normie')
      .replace(/\{\{CurrentValue\}\}/g, isAlarm ? '95%' : '10%')
      .replace(/\{\{Threshold\}\}/g, newRule.threshold || '80');
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#121A2F] border dark:border-slate-800 rounded-3xl w-full max-w-6xl p-8 shadow-2xl flex flex-col max-h-[90vh]">
        
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-extrabold flex items-center gap-3 text-slate-800 dark:text-slate-100">
            <div className="p-2 bg-amber-100 dark:bg-amber-500/20 rounded-xl"><Bell className="w-6 h-6 text-amber-600 dark:text-amber-400" /></div> 
            Zaawansowane Reguły i Szablony HTML
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-500 transition-colors"><X className="w-6 h-6 dark:text-white" /></button>
        </div>

        {!showTemplateEditor ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
            <div className={`border p-6 rounded-2xl mb-6 grid grid-cols-1 md:grid-cols-4 gap-5 shadow-inner ${editingId ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800/50' : 'bg-slate-50 dark:bg-[#0A0F1C] border-slate-200 dark:border-slate-800'}`}>
               <div className="col-span-1">
                 <label className="text-[11px] font-bold text-slate-500 uppercase">Serwer</label>
                 <select value={newRule.machineName} onChange={e => setNewRule({...newRule, machineName: e.target.value, serviceName: ''})} className="w-full mt-1.5 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-700 dark:text-slate-200 p-2.5 border border-slate-300 dark:border-slate-700 rounded-xl outline-none">
                   <option value="">-- Wybierz --</option>
                   {uniqueMachines.map(m => <option key={m} value={m}>{m}</option>)}
                 </select>
               </div>
               <div className="col-span-1">
                 <label className="text-[11px] font-bold text-slate-500 uppercase">Cel</label>
                 <select value={newRule.serviceName} onChange={e => { const val = e.target.value; setNewRule(prev => ({ ...prev, serviceName: val, metric: val === '*' ? 'MachineCpu' : 'State', threshold: val === '*' ? '80' : 'STOPPED' })); }} className="w-full mt-1.5 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-700 dark:text-slate-200 p-2.5 border border-slate-300 dark:border-slate-700 rounded-xl outline-none" disabled={!newRule.machineName}>
                   <option value="">-- Wybierz Cel --</option>
                   <option value="*">-- CAŁY SERWER --</option>
                   {newRule.machineName && groupedAgents[newRule.machineName]?.map(s => <option key={s.serviceName} value={s.serviceName}>{s.serviceName}</option>)}
                 </select>
               </div>
               <div className="col-span-2">
                 <label className="text-[11px] font-bold text-slate-500 uppercase">Warunek</label>
                 <div className="flex gap-2 mt-1.5">
                   <select value={newRule.metric} onChange={e => setNewRule({...newRule, metric: e.target.value})} className="w-1/2 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 p-2.5 border border-slate-300 dark:border-slate-700 rounded-xl outline-none" disabled={!newRule.serviceName}>
                     <option value="State">Status Usługi</option><option value="ServiceCpu">CPU Usługi (%) {'>'}</option><option value="ServiceRam">RAM Usługi (MB) {'>'}</option>
                   </select>
                   <input type="text" value={newRule.threshold} onChange={e => setNewRule({...newRule, threshold: e.target.value})} className="w-1/2 bg-white dark:bg-slate-900 text-sm font-bold text-slate-700 dark:text-slate-200 p-2.5 border border-slate-300 dark:border-slate-700 rounded-xl outline-none" disabled={!newRule.serviceName} />
                 </div>
               </div>
               
               <div className="col-span-2">
                 <label className="text-[11px] font-bold text-slate-500 uppercase">Email odbiorcy</label>
                 <input type="text" value={newRule.email} onChange={e => setNewRule({...newRule, email: e.target.value})} placeholder="admin@firma.pl" className="w-full mt-1.5 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-700 dark:text-slate-200 p-2.5 border border-slate-300 dark:border-slate-700 rounded-xl outline-none" />
               </div>

               <div className="col-span-1"><label className="text-[11px] font-bold text-slate-500 uppercase">Zwłoka (min)</label><input type="number" value={newRule.delayMinutes} onChange={e => setNewRule({...newRule, delayMinutes: parseInt(e.target.value) || 0})} className="w-full mt-1.5 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-700 dark:text-slate-200 p-2.5 border border-slate-300 dark:border-slate-700 rounded-xl outline-none" /></div>
               <div className="col-span-1"><label className="text-[11px] font-bold text-slate-500 uppercase">Przypomnienie (min)</label><input type="number" value={newRule.repeatMinutes} onChange={e => setNewRule({...newRule, repeatMinutes: parseInt(e.target.value) || 0})} className="w-full mt-1.5 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-700 dark:text-slate-200 p-2.5 border border-slate-300 dark:border-slate-700 rounded-xl outline-none" /></div>

               <div className="col-span-4 flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
                 <button onClick={() => setShowTemplateEditor(true)} className="bg-purple-600/20 hover:bg-purple-600/30 text-purple-600 dark:text-purple-400 border border-purple-500/30 text-xs px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-colors">
                   <Code className="w-4 h-4" /> Edytuj Szablon HTML (Split-View)
                 </button>
                 <div className="flex gap-2">
                   {editingId && <button onClick={cancelEdit} className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-white text-xs font-bold px-5 py-2.5 rounded-xl">Anuluj</button>}
                   <button onClick={saveRule} className={`text-white text-xs font-bold px-6 py-2.5 rounded-xl shadow-md ${editingId ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-amber-500 hover:bg-amber-400'}`}>
                     {editingId ? 'Zapisz Zmiany' : 'Utwórz Regułę'}
                   </button>
                 </div>
               </div>
            </div>

            <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-300 mb-3 border-b border-slate-200 dark:border-slate-800 pb-2">Istniejące Reguły</h3>
            <table className="w-full text-left border-collapse bg-slate-50 dark:bg-[#0A0F1C] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
               <thead className="bg-white/90 dark:bg-slate-900/90 text-[10px] font-extrabold uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
                 <tr><th className="p-4">Cel</th><th className="p-4">Warunek</th><th className="p-4">Odbiorcy</th><th className="p-4 text-right">Akcje</th></tr>
               </thead>
               <tbody className="text-sm font-mono text-slate-700 dark:text-slate-300">
                 {rules.map(rule => (
                    <tr key={rule.id} className="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/50">
                       <td className="p-4 font-bold text-slate-800 dark:text-slate-200">{rule.machineName} / {rule.serviceName}</td>
                       <td className="p-4 text-amber-500 font-bold">{rule.metric} &gt; {rule.threshold}</td>
                       <td className="p-4 truncate max-w-50">{rule.email}</td>
                       <td className="p-4 text-right flex justify-end gap-2">
                         <button onClick={() => editRule(rule)} className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-indigo-500"><Edit2 className="w-4 h-4" /></button>
                         <button onClick={() => removeRule(rule.id!)} className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>
                       </td>
                    </tr>
                 ))}
               </tbody>
            </table>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex flex-wrap justify-between items-center mb-4 bg-slate-100 dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Szablony:</span>
                <select data-template-select onChange={e => { const found = savedTemplates.find(t => t.id === e.target.value); if (found) { loadTemplate(found); } else { setTemplateName(''); }}} className="bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 outline-none">
                  <option value="">-- Załaduj zapisany szablon --</option>
                  {savedTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <input type="text" value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Nazwa szablonu..." className="bg-white dark:bg-slate-800 text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 outline-none w-36" />
                <button onClick={saveTemplateToDb} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 shadow-sm"><Save className="w-3.5 h-3.5" /> Zapisz</button>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 bg-slate-200 dark:bg-slate-800 p-1 rounded-lg">
                  <button onClick={() => setPreviewMode('alarm')} className={`text-xs px-2.5 py-1 rounded-md font-bold transition-all ${previewMode === 'alarm' ? 'bg-red-500 text-white' : 'text-slate-600 dark:text-slate-400'}`}>🚨 Alarm</button>
                  <button onClick={() => setPreviewMode('resolved')} className={`text-xs px-2.5 py-1 rounded-md font-bold transition-all ${previewMode === 'resolved' ? 'bg-emerald-500 text-white' : 'text-slate-600 dark:text-slate-400'}`}>✅ OK</button>
                </div>
                <button onClick={() => setShowTemplateEditor(false)} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-4 py-2 rounded-xl font-bold transition-all">Gotowe (Wróć)</button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
               <div className="flex flex-col border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-[#1e1e1e] h-full">
  <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 text-xs font-bold text-slate-400 flex items-center justify-between">
    <span>Edytor kodu HTML (Visual Studio Code Engine)</span>
    <button onClick={() => {
      const defaultCode = DEFAULT_TEMPLATE;
      setNewRule(prev => ({...prev, htmlTemplate: defaultCode}));
      setTemplateName('');
      const iframeEl = document.getElementById('monaco-iframe') as HTMLIFrameElement;
      if (iframeEl && iframeEl.contentWindow) {
        iframeEl.contentWindow.postMessage({ type: 'setTemplate', code: defaultCode }, '*');
      }
    }} className="text-cyan-400 hover:underline flex items-center gap-1">
      <RefreshCw className="w-3 h-3" /> Przywróć domyślny
    </button>
  </div>
  <iframe 
    id="monaco-iframe"
    title="MonacoEditor"
    className="w-full flex-1 border-0"
    srcDoc={`
      <!DOCTYPE html>
      <html>
        <head>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.46.0/min/vs/loader.min.js"></script>
        </head>
        <body style="margin:0; padding:0; height:100vh; overflow:hidden;">
          <div id="container" style="width:100%; height:100%;"></div>
          <script>
            let editorInstance;
            require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.46.0/min/vs' }});
            require(['vs/editor/editor.main'], function() {
              editorInstance = monaco.editor.create(document.getElementById('container'), {
                value: '',
                language: 'html',
                theme: 'vs-dark',
                automaticLayout: true,
                fontSize: 13,
                minimap: { enabled: false }
              });

              // Informuj rodzica o zmianach bez przeładowywania
              editorInstance.onDidChangeModelContent(() => {
                window.parent.postMessage({ type: 'codeChange', code: editorInstance.getValue() }, '*');
              });

              // Daj znać rodzicowi, że edytor jest gotowy na przyjęcie kodu
              window.parent.postMessage({ type: 'editorReady' }, '*');
            });

            // Nasłuch wiadomości od rodzica (inicjalizacja lub wczytanie szablonu)
            window.addEventListener('message', (event) => {
              if (event.data && (event.data.type === 'setTemplate' || event.data.type === 'init')) {
                if (editorInstance && editorInstance.getValue() !== event.data.code) {
                  editorInstance.setValue(event.data.code);
                }
              }
            });
          </script>
        </body>
      </html>
    `}
    onLoad={() => {
      // Gdy iframe się załaduje, wyślij aktualny stan szablonu do środka
      setTimeout(() => {
        const iframeEl = document.getElementById('monaco-iframe') as HTMLIFrameElement;
        if (iframeEl && iframeEl.contentWindow) {
          iframeEl.contentWindow.postMessage({ type: 'init', code: newRule.htmlTemplate || DEFAULT_TEMPLATE }, '*');
        }
      }, 300);
    }}
  />
</div>
               <div className="flex flex-col border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
                 <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2 border-b border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-2">
                   <Eye className="w-4 h-4 text-cyan-500" /> Żywy Podgląd Wiadomości E-mail
                 </div>
                 <div className="flex-1 p-6 overflow-y-auto bg-slate-50 dark:bg-[#050B14] flex items-center justify-center custom-scrollbar">
                   <div className="w-full shadow-xl rounded-xl overflow-hidden" dangerouslySetInnerHTML={{ __html: getRenderedPreview() }} />
                 </div>
               </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}