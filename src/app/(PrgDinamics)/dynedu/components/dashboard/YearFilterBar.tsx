"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Box, TextField, MenuItem, Typography } from "@mui/material";

type Props = {
  selectedYear: number;
  availableYears: number[];
  baseYear: number;
};

const YearFilterBar: React.FC<Props> = ({
  selectedYear,
  availableYears,
  baseYear,
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const years = Array.from(new Set(availableYears)).sort((a, b) => a - b);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newYear = event.target.value;
    const params = new URLSearchParams(searchParams?.toString() ?? "");

    if (String(newYear) === String(baseYear)) {
      // año base: quitamos el param para dejar la URL limpia
      params.delete("year");
    } else {
      params.set("year", String(newYear));
    }

    const query = params.toString();
    const url = query
      ? `/prgdinamics/dynedu?${query}`
      : `/prgdinamics/dynedu`;

    router.push(url);
  };

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
      }}
    >
      <Typography variant="body2" color="text.secondary">
        Ver año:
      </Typography>
      <TextField
        select
        size="small"
        value={selectedYear}
        onChange={handleChange}
      >
        {years.map((y) => (
          <MenuItem key={y} value={y}>
            {y}
            {y === baseYear ? " (actual)" : ""}
          </MenuItem>
        ))}
      </TextField>
    </Box>
  );
};

export default YearFilterBar;
