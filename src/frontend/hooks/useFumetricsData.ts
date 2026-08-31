import { useState, useEffect } from 'react';
import * as signalR from '@microsoft/signalr';
import { MetricItem, TimelineItem, LatestLogItem, AgentStatusItem } from '../types/fumetrics';

export function useFumetricsData() {
  const [summaryData, setSummaryData] = useState<MetricItem[]>([]);
  const [timelineData, setTimelineData] = useState<TimelineItem[]>([]);
  const [latestLogs, setLatestLogs] = useState<LatestLogItem[]>([]);
  const [agentsData, setAgentsData] = useState<AgentStatusItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('fumetrics_jwt');
    return {
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json'
    };
  };

  const fetchData = async () => {
    try {
      const baseUrl = `http://${window.location.hostname}:5170/api/metrics`;
      const headers = getAuthHeaders();

      const [summaryRes, timelineRes, latestRes, agentsRes] = await Promise.all([
        fetch(`${baseUrl}/summary`, { headers }), 
        fetch(`${baseUrl}/timeline`, { headers }), 
        fetch(`${baseUrl}/latest`, { headers }), 
        fetch(`${baseUrl}/agents`, { headers })
      ]);
      
      if (summaryRes.status === 401 || timelineRes.status === 401 || latestRes.status === 401 || agentsRes.status === 401) {
        throw new Error('UNAUTHORIZED');
      }
      if (!summaryRes.ok || !timelineRes.ok || !latestRes.ok || !agentsRes.ok) {
        throw new Error('Błąd pobierania danych z API');
      }
      
      setSummaryData(await summaryRes.json());
      setTimelineData(await timelineRes.json());
      setLatestLogs(await latestRes.json());
      setAgentsData(await agentsRes.json());
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Nie udało się połączyć z API .NET');
    }
  };

  const [machineTags, setMachineTags] = useState<Record<string, string[]>>({});

  const fetchTags = async () => {
    try {
      const res = await fetch(`http://${window.location.hostname}:5170/api/metrics/machines/tags`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setMachineTags(data);
      }
    } catch (err) {
      console.error("Błąd pobierania tagów", err);
    }
  };

  useEffect(() => {
    fetchData();
    fetchTags();

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`http://${window.location.hostname}:5170/hubs/telemetry`, {
        accessTokenFactory: () => localStorage.getItem('fumetrics_jwt') || ''
      })
      .withAutomaticReconnect()
      .build();

    connection.on("DataUpdated", () => fetchData());
    connection.on("AgentDataUpdated", () => fetchData());

    connection.start().catch(err => console.error("Błąd SignalR:", err));
    
    return () => { 
      connection.stop(); 
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { summaryData, timelineData, latestLogs, agentsData, machineTags, setAgentsData, fetchData, fetchTags, error };
}