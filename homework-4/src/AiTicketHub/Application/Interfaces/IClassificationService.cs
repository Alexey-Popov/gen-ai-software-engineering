// src/AiTicketHub/Application/Interfaces/IClassificationService.cs
using AiTicketHub.Application.DTOs;

namespace AiTicketHub.Application.Interfaces;

public interface IClassificationService
{
    ClassificationResult Classify(string subject, string description);
}
