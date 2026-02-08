// Copyright (c) 2026 TRV Enterprises LLC
// Licensed under Apache 2.0
// See LICENSE file for details.

package version

// These variables are set via ldflags during build
var (
	Version   = "dev"     // Semantic version (e.g., v0.2.0)
	BuildNum  = "unknown" // Build number from build.json
	GitCommit = "unknown" // Git commit hash
)

// Full returns the complete version string (e.g., v0.2.0+472)
func Full() string {
	return Version + "+" + BuildNum
}

// Info returns all version information as a map
func Info() map[string]string {
	return map[string]string{
		"version":    Version,
		"build":      BuildNum,
		"git_commit": GitCommit,
	}
}
