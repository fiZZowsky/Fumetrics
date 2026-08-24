using Fumetrics.Api.Contracts.Converters;
using System.Text.Json.Serialization;

namespace Fumetrics.Api.Contracts;

public record LogEntryDto(
    string Timestamp,
    string ServiceName,
    [property: JsonConverter(typeof(NumberToStringConverter))] string Level,
    string Message,
    Dictionary<string, string> Tags
    );