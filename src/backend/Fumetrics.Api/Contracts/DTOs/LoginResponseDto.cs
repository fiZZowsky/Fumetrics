namespace Fumetrics.Api.Contracts;

public record LoginResponseDto(string Token, DateTime Expiration);