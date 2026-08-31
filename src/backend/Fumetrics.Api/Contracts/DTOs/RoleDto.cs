namespace Fumetrics.Api.Contracts;

public class RoleDto
{
    public string Name { get; set; } = string.Empty;
    public string[] Permissions { get; set; } = Array.Empty<string>();
    public bool IsDefault { get; set; }
}

public class UserDto
{
    public string Username { get; set; } = string.Empty;
    public string RoleName { get; set; } = string.Empty;
    public string CreatedAt { get; set; } = string.Empty;
}

public class RoleAssignRequest
{
    public string RoleName { get; set; } = string.Empty;
}
