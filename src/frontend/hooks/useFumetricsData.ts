import { useState, useEffect } from 'react';
import * as signalR from '@microsoft/signalr';
import { MetricItem, TimelineItem, LatestLogItem, AgentStatusItem } from '../types/fumetrics';

export function useFumetricsData() {
  const [summaryData, setSummaryData] = useState<MetricItem[]>([]);
  const [timelineData, setTimelineData] = useState<TimelineItem[]>([]);
  const [latestLogs, setLatestLogs] = useState<LatestLogItem[]>([]);
  const [agentsData, setAgentsData] = useState<AgentStatusItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const baseUrl = `http://${window.location.hostname}:5170/api/metrics`;
      const [summaryRes, timelineRes, latestRes, agentsRes] = await Promise.all([
        fetch(`${baseUrl}/summary`), fetch(`${baseUrl}/timeline`), fetch(`${baseUrl}/latest`), fetch(`${baseUrl}/agents`)
      ]);
      
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

  useEffect(() => {
    fetchData();
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`http://${window.location.hostname}:5170/hubs/telemetry`)
      .withAutomaticReconnect()
      .build();

    connection.on("DataUpdated", () => fetchData());
    connection.on("AgentDataUpdated", () => fetchData());

    connection.start().catch(err => console.error("Błąd SignalR:", err));
    return () => { connection.stop(); };
  }, []);

  return { summaryData, timelineData, latestLogs, agentsData, setAgentsData, fetchData, error };
}