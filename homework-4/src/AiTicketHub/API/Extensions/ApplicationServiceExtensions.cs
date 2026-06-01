// src/AiTicketHub/API/Extensions/ApplicationServiceExtensions.cs
using AiTicketHub.Application.Interfaces;
using AiTicketHub.Application.Services;
using Microsoft.Extensions.DependencyInjection;

namespace AiTicketHub.API.Extensions;

public static class ApplicationServiceExtensions
{
    public static IServiceCollection AddApplicationServices(this IServiceCollection services)
    {
        services.AddScoped<ITicketService, TicketService>();
        services.AddScoped<ITicketImportService, TicketImportService>();
        return services;
    }
}
