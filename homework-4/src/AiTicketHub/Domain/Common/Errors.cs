// src/AiTicketHub/Domain/Common/Errors.cs
namespace AiTicketHub.Domain.Common;

public static class Errors
{
    public static readonly Error TicketNotFound      = new("Ticket.NotFound",      "Ticket not found.");                        // 404
    public static readonly Error TicketInvalidStatus = new("Ticket.InvalidStatus", "Invalid or disallowed status transition."); // 422
    public static readonly Error TicketDuplicate     = new("Ticket.Duplicate",     "Duplicate ticket detected.");               // 409
    public static readonly Error ValidationFailed    = new("Validation.Failed",    "One or more validation errors occurred."); // 400
    public static readonly Error GeneralUnexpected   = new("General.Unexpected",   "An unexpected error occurred.");           // 500
}
