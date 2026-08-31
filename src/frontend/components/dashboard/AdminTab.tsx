import { useState, useEffect } from 'react';
import { Shield, Users, Trash2, Edit2, Check, X, ShieldAlert, Key } from 'lucide-react';

interface RoleDto {
  name: string;
  permissions: string[];
  isDefault: boolean;
}

interface UserDto {
  username: string;
  roleName: string;
  createdAt: string;
}

const AVAILABLE_PERMISSIONS = [
  { id: 'ManageRoles', label: 'Zarządzanie Rolami' },
  { id: 'ManageUsers', label: 'Zarządzanie Użytkownikami' },
  { id: 'ManageAlerts', label: 'Zarządzanie Alertami' },
  { id: 'StartStopServices', label: 'Start/Stop Usług' }
];

export function AdminTab() {
  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [users, setUsers] = useState<UserDto[]>([]);
  const [loading, setLoading] = useState(true);

  // Zmienne dla nowych/edytowanych ról
  const [newRoleName, setNewRoleName] = useState('');
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [editingRole, setEditingRole] = useState<string | null>(null);

  const fetchRolesAndUsers = async () => {
    try {
      const token = localStorage.getItem('fumetrics_jwt');
      const headers = { 'Authorization': `Bearer ${token}` };

      const [resRoles, resUsers] = await Promise.all([
        fetch(`http://${window.location.hostname}:5170/api/roles`, { headers }),
        fetch(`http://${window.location.hostname}:5170/api/users`, { headers })
      ]);

      if (resRoles.ok) {
        const rawRoles = await resRoles.json();
        setRoles(Array.from(new Map(rawRoles.map((r: any) => [r.name, r])).values()) as RoleDto[]);
      }
      if (resUsers.ok) {
        const rawUsers = await resUsers.json();
        setUsers(Array.from(new Map(rawUsers.map((u: any) => [u.username, u])).values()) as UserDto[]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRolesAndUsers();
  }, []);

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    
    try {
      const token = localStorage.getItem('fumetrics_jwt');
      await fetch(`http://${window.location.hostname}:5170/api/roles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newRoleName.trim(), permissions: selectedPerms })
      });
      setNewRoleName('');
      setSelectedPerms([]);
      setEditingRole(null);
      fetchRolesAndUsers();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteRole = async (name: string) => {
    try {
      const token = localStorage.getItem('fumetrics_jwt');
      const res = await fetch(`http://${window.location.hostname}:5170/api/roles/${name}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) fetchRolesAndUsers();
      else alert(await res.text());
    } catch (err) {
      console.error(err);
    }
  };

  const handleTogglePerm = (perm: string) => {
    setSelectedPerms(prev => prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]);
  };

  const handleStartEditRole = (role: RoleDto) => {
    if (role.isDefault) return;
    setEditingRole(role.name);
    setNewRoleName(role.name);
    setSelectedPerms(role.permissions || []);
  };

  const handleChangeUserRole = async (username: string, newRole: string) => {
    try {
      const token = localStorage.getItem('fumetrics_jwt');
      const res = await fetch(`http://${window.location.hostname}:5170/api/users/${username}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ roleName: newRole })
      });
      if (res.ok) fetchRolesAndUsers();
      else alert(await res.text());
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="text-center p-8 text-slate-500">Ładowanie panelu administratora...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* ZARZĄDZANIE ROLAMI */}
        <div className="bg-white dark:bg-[#121A2F] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-rose-100 dark:bg-rose-500/20 p-2.5 rounded-xl">
              <Shield className="w-6 h-6 text-rose-600 dark:text-rose-400" />
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Role i Uprawnienia</h2>
          </div>

          <form onSubmit={handleSaveRole} className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 mb-6">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">{editingRole ? `Edytuj rolę: ${editingRole}` : 'Stwórz nową rolę'}</h3>
            <div className="mb-4">
              <input 
                type="text" 
                value={newRoleName} 
                onChange={e => setNewRoleName(e.target.value)} 
                disabled={!!editingRole}
                placeholder="Nazwa roli (np. Operator)" 
                className="w-full bg-white dark:bg-[#0A0F1C] text-sm font-semibold text-slate-900 dark:text-slate-100 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 outline-none focus:border-rose-500" 
              />
            </div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {AVAILABLE_PERMISSIONS.map(p => (
                <label key={p.id} className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 cursor-pointer">
                  <input type="checkbox" checked={selectedPerms.includes(p.id)} onChange={() => handleTogglePerm(p.id)} className="rounded text-rose-500 focus:ring-rose-500" />
                  {p.label}
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold py-2 rounded-xl transition-colors flex items-center justify-center gap-2">
                <Check className="w-4 h-4" /> Zapisz Rolę
              </button>
              {editingRole && (
                <button type="button" onClick={() => { setEditingRole(null); setNewRoleName(''); setSelectedPerms([]); }} className="px-4 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-xl transition-colors">
                  Anuluj
                </button>
              )}
            </div>
          </form>

          <div className="space-y-3">
            {roles.map(role => (
              <div key={role.name} className="flex flex-col gap-2 bg-slate-50 dark:bg-[#0A0F1C] p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{role.name}</span>
                    {role.isDefault && <span className="bg-slate-200 dark:bg-slate-800 text-slate-500 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Wbudowana</span>}
                  </div>
                  {!role.isDefault && (
                    <div className="flex gap-2">
                      <button onClick={() => handleStartEditRole(role)} className="text-slate-400 hover:text-blue-500 transition-colors p-1"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDeleteRole(role.name)} className="text-slate-400 hover:text-red-500 transition-colors p-1"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>
                {role.permissions && role.permissions.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {role.permissions.map(p => (
                      <span key={p} className="bg-indigo-100 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 text-[10px] px-2 py-0.5 rounded-lg font-semibold flex items-center gap-1">
                        <Key className="w-3 h-3" /> {AVAILABLE_PERMISSIONS.find(ap => ap.id === p)?.label || p}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">Brak uprawnień (tylko odczyt)</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ZARZĄDZANIE UŻYTKOWNIKAMI */}
        <div className="bg-white dark:bg-[#121A2F] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-blue-100 dark:bg-blue-500/20 p-2.5 rounded-xl">
              <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Użytkownicy</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 uppercase tracking-wider">
                  <th className="pb-3 font-semibold">Użytkownik</th>
                  <th className="pb-3 font-semibold">Rola</th>
                  <th className="pb-3 font-semibold">Konto założone</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.username} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors group">
                    <td className="py-4 text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      {u.username === 'admin' && <ShieldAlert className="w-4 h-4 text-rose-500" title="Główny Administrator" />}
                      {u.username}
                    </td>
                    <td className="py-4">
                      {u.username === 'admin' ? (
                        <span className="text-xs font-bold text-rose-500 px-3 py-1 bg-rose-100 dark:bg-rose-500/10 rounded-lg">Admin</span>
                      ) : (
                        <select 
                          value={u.roleName}
                          onChange={(e) => handleChangeUserRole(u.username, e.target.value)}
                          className="bg-white dark:bg-[#0A0F1C] text-xs font-bold text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 outline-none focus:border-blue-500 cursor-pointer"
                        >
                          {roles.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
                        </select>
                      )}
                    </td>
                    <td className="py-4 text-xs font-semibold text-slate-500">
                      {u.createdAt}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
