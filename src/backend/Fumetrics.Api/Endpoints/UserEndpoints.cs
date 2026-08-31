using Fumetrics.Api.Contracts;
using Fumetrics.Api.Data;
using Microsoft.AspNetCore.Mvc;

namespace Fumetrics.Api.Endpoints;

public static class UserEndpoints
{
    public static void MapUserEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/users").RequireCors("CorsPolicy").RequireAuthorization(policy => policy.RequireAssertion(ctx => ctx.User.IsInRole("Admin") || ctx.User.HasClaim("Permission", "ManageUsers")));

        group.MapGet("/", async ([FromServices] ClickHouseConnectionFactory dbFactory) =>
        {
            var users = new List<UserDto>();
            using var conn = dbFactory.CreateConnection();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT Username, RoleName, toString(CreatedAt) FROM users FINAL ORDER BY Username";
            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                users.Add(new UserDto
                {
                    Username = reader.GetString(0),
                    RoleName = reader.GetString(1),
                    CreatedAt = reader.GetString(2)
                });
            }
            return Results.Ok(users);
        });

        group.MapPut("/{username}/role", async (string username, [FromBody] RoleAssignRequest request, [FromServices] ClickHouseConnectionFactory dbFactory) =>
        {
            if (username == "admin") return Results.BadRequest("Nie można zmienić roli głównego administratora.");

            using var conn = dbFactory.CreateConnection();
            using var checkRoleCmd = conn.CreateCommand();
            checkRoleCmd.CommandText = $"SELECT count() FROM roles WHERE Name = '{request.RoleName}'";
            if (Convert.ToInt64(await checkRoleCmd.ExecuteScalarAsync()) == 0)
            {
                return Results.BadRequest("Taka rola nie istnieje.");
            }

            using var cmd = conn.CreateCommand();
            cmd.CommandText = $"ALTER TABLE users UPDATE RoleName = '{request.RoleName}' WHERE Username = '{username}'";
            await cmd.ExecuteNonQueryAsync();

            return Results.Ok(new { success = true });
        });
    }
}
