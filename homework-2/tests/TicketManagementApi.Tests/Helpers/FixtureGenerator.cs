using System;
using System.IO;
using System.Text;

namespace TicketManagementApi.Tests.Helpers;

public static class FixtureGenerator
{
    private static readonly string[] Names = { "Alice Smith", "Bob Jones", "Charlie Brown", "Diana Prince", "Evan Wright" };
    private static readonly string[] Emails = { "alice@example.com", "bob@example.org", "charlie@gmail.com", "diana@outlook.com", "evan@yahoo.com" };
    
    private static readonly string[] Subjects = 
    {
        "Cannot login to account",
        "Error on billing invoice payment",
        "Feature request: add dark mode",
        "Bug: crash when clicking button",
        "General question about subscription plans",
        "Security issue with 2FA setup",
        "Refund request for last month",
        "Cosmetic issue on profile page",
        "Production down: critical database failure",
        "blocking bug in API call asap"
    };

    private static readonly string[] Descriptions =
    {
        "I am trying to sign in but keep getting a wrong credentials message. Please reset my password.",
        "The system shows payment failed but my credit card was charged $49. Please send invoice receipt.",
        "It would be great if you could add a dark mode feature to the dashboard. It would improve usability.",
        "Steps to reproduce: 1. Go to page A, 2. Click button B, 3. The page crashes and displays an error code.",
        "I have a minor question about the difference between standard and pro subscription costs.",
        "The authenticator app doesn't scan the barcode for 2FA. Can't access my account credentials.",
        "I want to request a refund for the duplicate transaction. The invoice number is INV-12345.",
        "There is a minor typo on the landing page header. Please fix this cosmetic suggestion.",
        "Our API is completely down, returning error 500. This is a critical production down safety breach.",
        "This is an important blocking issue. The export is not working. We need this fixed asap."
    };

    public static void GenerateAll(string targetDirectory)
    {
        if (!Directory.Exists(targetDirectory))
        {
            Directory.CreateDirectory(targetDirectory);
        }

        GenerateCsv(Path.Combine(targetDirectory, "sample_tickets.csv"), 50);
        GenerateJson(Path.Combine(targetDirectory, "sample_tickets.json"), 20);
        GenerateXml(Path.Combine(targetDirectory, "sample_tickets.xml"), 30);

        GenerateInvalidCsv(Path.Combine(targetDirectory, "invalid_tickets.csv"));
        GenerateInvalidJson(Path.Combine(targetDirectory, "invalid_tickets.json"));
        GenerateInvalidXml(Path.Combine(targetDirectory, "invalid_tickets.xml"));
    }

    private static void GenerateCsv(string path, int count)
    {
        var sb = new StringBuilder();
        sb.AppendLine("customer_id,customer_email,customer_name,subject,description,category,priority,status,assigned_to,tags,source,browser,device_type");

        var rand = new Random(42); // deterministic seed
        for (int i = 0; i < count; i++)
        {
            var customerId = $"CUST-{1000 + i}";
            var email = Emails[rand.Next(Emails.Length)];
            var name = Names[rand.Next(Names.Length)];
            var idx = rand.Next(Subjects.Length);
            var subject = Subjects[idx];
            var description = Descriptions[idx];

            // Some have explicit fields, some let auto-classify handle them
            string category = i % 3 == 0 ? "" : (i % 3 == 1 ? "account_access" : "technical_issue");
            string priority = i % 4 == 0 ? "" : (i % 4 == 1 ? "urgent" : "high");
            string status = i % 5 == 0 ? "new" : "in_progress";
            string assignedTo = i % 2 == 0 ? $"agent_{i}" : "";
            string tags = $"tag_{i};tag_{i+1}";
            string source = i % 3 == 0 ? "web_form" : (i % 3 == 1 ? "email" : "api");
            string browser = "Chrome 125";
            string deviceType = i % 2 == 0 ? "desktop" : "mobile";

            // Escape commas/quotes in subject and description
            subject = EscapeCsvField(subject);
            description = EscapeCsvField(description);

            sb.AppendLine($"{customerId},{email},{name},{subject},{description},{category},{priority},{status},{assignedTo},{tags},{source},{browser},{deviceType}");
        }

        File.WriteAllText(path, sb.ToString(), Encoding.UTF8);
    }

    private static void GenerateJson(string path, int count)
    {
        var sb = new StringBuilder();
        sb.AppendLine("[");

        var rand = new Random(43);
        for (int i = 0; i < count; i++)
        {
            var customerId = $"CUST-{2000 + i}";
            var email = Emails[rand.Next(Emails.Length)];
            var name = Names[rand.Next(Names.Length)];
            var idx = rand.Next(Subjects.Length);
            var subject = EscapeJsonField(Subjects[idx]);
            var description = EscapeJsonField(Descriptions[idx]);

            string categoryJson = i % 3 == 0 ? "" : $"\"category\": \"{(i % 3 == 1 ? "billing_question" : "feature_request")}\", ";
            string priorityJson = i % 4 == 0 ? "" : $"\"priority\": \"{(i % 4 == 1 ? "medium" : "low")}\", ";
            string assignedJson = i % 2 == 0 ? $"\"assigned_to\": \"agent_{i}\", " : "";

            string source = i % 3 == 0 ? "chat" : "phone";
            string deviceType = "tablet";

            sb.AppendLine("  {");
            sb.AppendLine($"    \"customer_id\": \"{customerId}\",");
            sb.AppendLine($"    \"customer_email\": \"{email}\",");
            sb.AppendLine($"    \"customer_name\": \"{name}\",");
            sb.AppendLine($"    \"subject\": \"{subject}\",");
            sb.AppendLine($"    \"description\": \"{description}\",");
            if (!string.IsNullOrEmpty(categoryJson)) sb.Append("    ").AppendLine(categoryJson);
            if (!string.IsNullOrEmpty(priorityJson)) sb.Append("    ").AppendLine(priorityJson);
            if (!string.IsNullOrEmpty(assignedJson)) sb.Append("    ").AppendLine(assignedJson);
            sb.AppendLine("    \"status\": \"new\",");
            sb.AppendLine("    \"tags\": [\"import_json\", \"test\"],");
            sb.AppendLine("    \"metadata\": {");
            sb.AppendLine($"      \"source\": \"{source}\",");
            sb.AppendLine("      \"browser\": \"Safari 17\",");
            sb.AppendLine($"      \"device_type\": \"{deviceType}\"");
            sb.AppendLine("    }");
            sb.Append("  }");
            if (i < count - 1) sb.AppendLine(",");
            else sb.AppendLine();
        }

        sb.AppendLine("]");
        File.WriteAllText(path, sb.ToString(), Encoding.UTF8);
    }

    private static void GenerateXml(string path, int count)
    {
        var sb = new StringBuilder();
        sb.AppendLine("<?xml version=\"1.0\" encoding=\"utf-8\"?>");
        sb.AppendLine("<tickets>");

        var rand = new Random(44);
        for (int i = 0; i < count; i++)
        {
            var customerId = $"CUST-{3000 + i}";
            var email = Emails[rand.Next(Emails.Length)];
            var name = Names[rand.Next(Names.Length)];
            var idx = rand.Next(Subjects.Length);
            var subject = EscapeXmlField(Subjects[idx]);
            var description = EscapeXmlField(Descriptions[idx]);

            string categoryXml = i % 3 == 0 ? "" : $"<category>{(i % 3 == 1 ? "bug_report" : "other")}</category>";
            string priorityXml = i % 4 == 0 ? "" : $"<priority>{(i % 4 == 1 ? "high" : "low")}</priority>";

            string source = "web_form";
            string deviceType = "desktop";

            sb.AppendLine("  <ticket>");
            sb.AppendLine($"    <customer_id>{customerId}</customer_id>");
            sb.AppendLine($"    <customer_email>{email}</customer_email>");
            sb.AppendLine($"    <customer_name>{name}</customer_name>");
            sb.AppendLine($"    <subject>{subject}</subject>");
            sb.AppendLine($"    <description>{description}</description>");
            if (!string.IsNullOrEmpty(categoryXml)) sb.AppendLine($"    {categoryXml}");
            if (!string.IsNullOrEmpty(priorityXml)) sb.AppendLine($"    {priorityXml}");
            sb.AppendLine("    <status>new</status>");
            sb.AppendLine("    <tags><tag>xml_import</tag><tag>test</tag></tags>");
            sb.AppendLine("    <metadata>");
            sb.AppendLine($"      <source>{source}</source>");
            sb.AppendLine("      <browser>Firefox 126</browser>");
            sb.AppendLine($"      <device_type>{deviceType}</device_type>");
            sb.AppendLine("    </metadata>");
            sb.AppendLine("  </ticket>");
        }

        sb.AppendLine("</tickets>");
        File.WriteAllText(path, sb.ToString(), Encoding.UTF8);
    }

    private static void GenerateInvalidCsv(string path)
    {
        var sb = new StringBuilder();
        sb.AppendLine("customer_id,customer_email,customer_name,subject,description,category,priority,status,assigned_to,tags,source,browser,device_type");
        // Row 2: Valid
        sb.AppendLine("CUST-999,test@example.com,John Doe,Login issue,I cannot login reset password please,account_access,urgent,new,,tag,web_form,Chrome,desktop");
        // Row 3: Missing customer_id (validation error)
        sb.AppendLine(",test@example.com,John Doe,Login issue,I cannot login reset password please,account_access,urgent,new,,tag,web_form,Chrome,desktop");
        // Row 4: Invalid email (validation error)
        sb.AppendLine("CUST-999,not-an-email,John Doe,Login issue,I cannot login reset password please,account_access,urgent,new,,tag,web_form,Chrome,desktop");
        // Row 5: Description too short (validation error)
        sb.AppendLine("CUST-999,test@example.com,John Doe,Login issue,short,account_access,urgent,new,,tag,web_form,Chrome,desktop");
        // Row 6: Invalid category enum (parsing error)
        sb.AppendLine("CUST-999,test@example.com,John Doe,Login issue,I cannot login reset password please,invalid_category_enum,urgent,new,,tag,web_form,Chrome,desktop");
        // Row 7: Invalid source enum (parsing error)
        sb.AppendLine("CUST-999,test@example.com,John Doe,Login issue,I cannot login reset password please,account_access,urgent,new,,tag,invalid_source_enum,Chrome,desktop");

        File.WriteAllText(path, sb.ToString(), Encoding.UTF8);
    }

    private static void GenerateInvalidJson(string path)
    {
        // Missing closing bracket makes this syntactically malformed JSON
        var malformedJson = @"[
  {
    ""customer_id"": ""CUST-999"",
    ""customer_email"": ""invalid-email"",
    ""customer_name"": ""John Doe"",
    ""subject"": ""No login"",
    ""description"": ""Too short"",
    ""metadata"": {
      ""source"": ""web_form"",
      ""device_type"": ""desktop""
    }
  }
";
        File.WriteAllText(path, malformedJson, Encoding.UTF8);
    }

    private static void GenerateInvalidXml(string path)
    {
        // Malformed XML structure (missing closing </ticket> tag)
        var malformedXml = @"<?xml version=""1.0"" encoding=""utf-8""?>
<tickets>
  <ticket>
    <customer_id>CUST-999</customer_id>
    <customer_email>not-an-email</customer_email>
    <customer_name>John Doe</customer_name>
    <subject>Help</subject>
    <description>Short</description>
  <!-- missing closing ticket -->
</tickets>
";
        File.WriteAllText(path, malformedXml, Encoding.UTF8);
    }

    private static string EscapeCsvField(string field)
    {
        if (field.Contains(",") || field.Contains("\"") || field.Contains("\n") || field.Contains("\r"))
        {
            return "\"" + field.Replace("\"", "\"\"") + "\"";
        }
        return field;
    }

    private static string EscapeJsonField(string field)
    {
        return field.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", "\\n").Replace("\r", "\\r");
    }

    private static string EscapeXmlField(string field)
    {
        return field.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;").Replace("\"", "&quot;").Replace("'", "&apos;");
    }
}
