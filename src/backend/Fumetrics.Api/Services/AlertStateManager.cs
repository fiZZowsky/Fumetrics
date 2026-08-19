namespace Fumetrics.Api.Services;

public class AlertState
{
    public DateTime FirstSeen { get; set; }
    public DateTime? LastSent { get; set; }
    public bool IsFiring { get; set; }
}

public class AlertStateManager
{
    public Dictionary<string, AlertState> ActiveStates { get; } = new();
}