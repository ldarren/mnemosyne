# ADR-001: SAML over OIDC

**Status:** Accepted
**Date:** 2026-02-10
**Deciders:** [Joe Smith](../users/joe-smith), [Sarah Chen](../users/sarah-chen)

## Context

Need to integrate SSO for [SSO Integration](req-sso-integration). Corporate IdP only supports SAML 2.0.

## Decision

Use SAML 2.0 via Okta SDK.

## Consequences

- Must handle XML parsing for SAML assertions
- Okta SDK dependency added to [Auth Service](sys-auth-service)
