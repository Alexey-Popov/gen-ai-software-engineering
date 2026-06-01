// src/AiTicketHub/API/Extensions/InfrastructureServiceExtensions.cs
using AiTicketHub.Application.Interfaces;
using AiTicketHub.Infrastructure.Parsers;
using AiTicketHub.Infrastructure.Repositories;
using AiTicketHub.Infrastructure.Services;
using Microsoft.Extensions.DependencyInjection;

namespace AiTicketHub.API.Extensions;

public static class InfrastructureServiceExtensions
{
    public static IServiceCollection AddInfrastructureServices(this IServiceCollection services)
    {
        services.AddSingleton<ITicketRepository,      TicketRepository>();
        services.AddSingleton<IClassificationService, KeywordClassifier>();

        services.AddScoped<ICsvTicketParser,  CsvTicketParser>();
        services.AddScoped<IJsonTicketParser, JsonTicketParser>();
        services.AddScoped<IXmlTicketParser,  XmlTicketParser>();

        return services;
    }
}
