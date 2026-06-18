import { Html, Body, Container, Heading, Text, Button, Hr } from "@react-email/components";

interface NewTicketEmailProps {
  ticketId: string;
  submitterName: string;
  submitterEmail: string;
  subject: string;
  priority: "low" | "medium" | "high" | "urgent";
  categoryName: string;
  body: string;
  dashboardUrl: string;
}

const priorityConfig: Record<
  NewTicketEmailProps["priority"],
  { label: string; color: string; fontWeight?: string }
> = {
  low: { label: "Low", color: "#666" },
  medium: { label: "Medium", color: "#b45309" },
  high: { label: "High", color: "#c2410c" },
  urgent: { label: "URGENT", color: "#dc2626", fontWeight: "700" },
};

export default function NewTicketEmail({
  ticketId: _ticketId,
  submitterName,
  submitterEmail,
  subject,
  priority,
  categoryName,
  body,
  dashboardUrl,
}: NewTicketEmailProps) {
  const pConfig = priorityConfig[priority] ?? priorityConfig.low;

  return (
    <Html lang="en">
      <Body
        style={{
          backgroundColor: "#ffffff",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          margin: "0",
          padding: "0",
        }}
      >
        <Container
          style={{
            maxWidth: "560px",
            margin: "40px auto",
            padding: "0 20px",
          }}
        >
          <Text
            style={{
              fontSize: "16px",
              lineHeight: "1.5",
              color: "#1a1a1a",
              margin: "0 0 16px",
            }}
          >
            A new support ticket has been submitted.
          </Text>

          <Heading
            as="h2"
            style={{
              fontSize: "20px",
              fontWeight: "600",
              color: "#1a1a1a",
              margin: "0 0 12px",
              lineHeight: "1.3",
            }}
          >
            {subject}
          </Heading>

          <Text
            style={{
              fontSize: "14px",
              lineHeight: "1.5",
              color: "#444",
              margin: "0 0 8px",
            }}
          >
            Priority:{" "}
            <span
              style={{
                color: pConfig.color,
                fontWeight: pConfig.fontWeight ?? "normal",
              }}
            >
              {pConfig.label}
            </span>
            {"  ·  "}Category: {categoryName}
          </Text>

          <Text
            style={{
              fontSize: "14px",
              lineHeight: "1.5",
              color: "#444",
              margin: "0 0 16px",
            }}
          >
            From: {submitterName} &lt;{submitterEmail}&gt;
          </Text>

          <Text
            style={{
              fontSize: "15px",
              lineHeight: "1.6",
              color: "#1a1a1a",
              backgroundColor: "#f4f4f4",
              padding: "16px",
              borderRadius: "4px",
              whiteSpace: "pre-wrap",
              margin: "0 0 24px",
            }}
          >
            {body}
          </Text>

          <Button
            href={dashboardUrl}
            style={{
              backgroundColor: "#1a1a1a",
              color: "#ffffff",
              padding: "12px 20px",
              borderRadius: "4px",
              fontSize: "14px",
              fontWeight: "600",
              textDecoration: "none",
              display: "inline-block",
              marginBottom: "24px",
            }}
          >
            View in Dashboard
          </Button>

          <Hr
            style={{
              border: "none",
              borderTop: "1px solid #eaeaea",
              margin: "0 0 16px",
            }}
          />

          <Text
            style={{
              fontSize: "12px",
              lineHeight: "1.5",
              color: "#666",
              margin: "0",
            }}
          >
            This is an automated notification from your support ticket system.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
