using Fumetrics.Api.Contracts;
using Fumetrics.Api.Data;
using Fumetrics.Api.Extensions;
using Microsoft.AspNetCore.Mvc;

namespace Fumetrics.Api.Endpoints;

public static class RoleEndpoints
{
    public static void MapRoleEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/roles").RequireCors("CorsPolicy").RequireAuthorization(policy => policy.RequireAssertion(ctx => ctx.User.IsInRole("Admin") || ctx.User.HasClaim("Permission", "ManageRoles")));

        group.MapGet("/", async ([FromServices] ClickHouseConnectionFactory dbFactory) =>
        {
            var roles = new List<RoleDto>();
            using var conn = dbFactory.CreateConnection();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT Name, Permissions, IsDefault FROM roles FINAL ORDER BY Name";
            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var permsList = new List<string>();
                if (!reader.IsDBNull(1))
                {
                    var rawArray = reader.GetValue(1) as System.Collections.IEnumerable;
                    if (rawArray != null)
                    {
                        foreach (var item in rawArray) permsList.Add(item?.ToString() ?? "");
                    }
                }

                roles.Add(new RoleDto
                {
                    Name = reader.GetString(0),
                    Permissions = permsList.ToArray(),
                    IsDefault = reader.GetByte(2) == 1
                });
            }
            return Results.Ok(roles);
        });

        group.MapPost("/", async ([FromBody] RoleDto request, [FromServices] ClickHouseConnectionFactory dbFactory) =>
        {
            if (string.IsNullOrWhiteSpace(request.Name)) return Results.BadRequest("Nazwa roli jest wymagana.");
            
            using var conn = dbFactory.CreateConnection();
            using var checkCmd = conn.CreateCommand();
            checkCmd.CommandText = $"SELECT IsDefault FROM roles WHERE Name = '{request.Name}'";
            var isDefaultObj = await checkCmd.ExecuteScalarAsync();
            if (isDefaultObj != null && Convert.ToByte(isDefaultObj) == 1)
            {
                return Results.BadRequest("Nie można edytować wbudowanych ról.");
            }

            var perms = string.Join(",", request.Permissions.Select(p => $"'{p}'"));
            
            using var cmd = conn.CreateCommand();
            cmd.CommandText = $"INSERT INTO roles (Name, Permissions, IsDefault) VALUES ('{request.Name}', [{perms}], 0)";
            await cmd.ExecuteNonQueryAsync();

            return Results.Ok(new { success = true });
        });

        group.MapDelete("/{name}", async (string name, [FromServices] ClickHouseConnectionFactory dbFactory) =>
        {
            using var conn = dbFactory.CreateConnection();
            using var checkCmd = conn.CreateCommand();
            checkCmd.CommandText = $"SELECT IsDefault FROM roles WHERE Name = '{name}'";
            var isDefaultObj = await checkCmd.ExecuteScalarAsync();
            if (isDefaultObj != null && Convert.ToByte(isDefaultObj) == 1)
            {
                return Results.BadRequest("Nie można usunąć wbudowanych ról.");
            }

            using var checkUsersCmd = conn.CreateCommand();
            checkUsersCmd.CommandText = $"SELECT count() FROM users WHERE RoleName = '{name}'";
            if (Convert.ToInt64(await checkUsersCmd.ExecuteScalarAsync()) > 0)
            {
                return Results.BadRequest("Nie można usunąć roli przypisanej do użytkowników.");
            }

            using var cmd = conn.CreateCommand();
            cmd.CommandText = $"ALTER TABLE roles DELETE WHERE Name = '{name}'";
            await cmd.ExecuteNonQueryAsync();

            return Results.Ok(new { success = true });
        });
    }
}
