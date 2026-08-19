export interface MetricItem { serviceName: string; level: string; count: number; }
export interface TimelineItem { timeWindow: string; level: string; count: number; }
export interface LatestLogItem { timestamp: string; serviceName: string; level: string; message: string; }
export interface AgentStatusItem { machineName: string; osVersion: string; serviceName: string; state: string; lastUpdated: string; machineCpu: number; machineRam: number; machineDisk: number; serviceCpu: number; serviceRam: number; serviceDisk: number; }
export interface AgentHistoryItem { timestamp: string; cpu: number; ram: number; disk: number; }
export interface ScannedService { serviceName: string; displayName: string; processId: number; state: string; }
export interface SavedServer { machineName: string; ipAddress: string; port: string; }
export interface AlertRule { id?: string; machineName: string; serviceName: string; metric: string; threshold: string; email: string; delayMinutes: number; repeatMinutes: number; }